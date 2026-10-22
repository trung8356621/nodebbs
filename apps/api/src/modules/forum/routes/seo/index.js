import {CREDIT_VND} from '../../services/seo/constants.js';
import {seoError} from '../../services/seo/errors.js';
import {sql} from 'drizzle-orm';
import {rows} from '../../services/pinService.js';
export default async function seoRoutes(fastify){
  fastify.setErrorHandler((error,request,reply)=>{const safe=seoError(error);if(safe.status===500)fastify.log.error({err:error,topicId:request.params?.topicId},'SEO checkout failed');reply.code(safe.status).send({code:safe.code,message:safe.message});});
  fastify.get('/me',{preHandler:[fastify.authenticate],schema:{querystring:{type:'object',properties:{page:{type:'integer',minimum:1,maximum:10000,default:1}},additionalProperties:false}}},async request=>{const user=request.user.id,offset=(request.query.page-1)*20;const purchases=await rows(sql`SELECT p.*,t.title,e.starts_at,e.expires_at,e.status,EXISTS(SELECT 1 FROM seo_entitlements previous WHERE previous.topic_id=e.topic_id AND previous.expires_at=e.starts_at AND previous.id<>e.id) AS renewal FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id JOIN topics t ON t.id=p.topic_id WHERE p.user_id=${user} ORDER BY p.created_at DESC,p.id LIMIT 20 OFFSET ${offset}`);const [{total}]=await rows(sql`SELECT count(*)::int AS total FROM seo_purchases WHERE user_id=${user}`);const events=purchases.length?await rows(sql`SELECT ev.* FROM seo_events ev JOIN seo_purchases p ON p.id=ev.purchase_id WHERE p.user_id=${user} AND ev.purchase_id IN (${sql.join(purchases.map(p=>sql`${p.id}::uuid`),sql`,`)}) ORDER BY ev.created_at DESC LIMIT 100`):[];return {purchases,total,page:request.query.page,events,creditVnd:CREDIT_VND};});
  const auth={preHandler:[fastify.authenticate]};
  const admin={preHandler:[fastify.requirePermission('dashboard.shop')]};
  const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
  const topicParams=object({topicId:{type:'integer',minimum:1}},['topicId']);
  fastify.get('/products',()=>fastify.seo.products());
  fastify.get('/topics/:topicId',{...auth,schema:{params:topicParams}},request=>fastify.seo.history(request.params.topicId,request.user.id));
  fastify.post('/topics/:topicId/quotes',{...auth,schema:{params:topicParams,body:object({productId:{type:'string',pattern:'^[-a-z0-9]{1,80}$'}},['productId'])}},request=>fastify.seo.quote(request.params.topicId,request.user.id,request.body.productId));
  fastify.post('/topics/:topicId/purchase',{...auth,schema:{params:topicParams,body:object({quoteId:{type:'string',format:'uuid'},idempotencyKey:{type:'string',minLength:16,maxLength:100}},['quoteId','idempotencyKey'])}},request=>fastify.seo.purchase({topicId:request.params.topicId,userId:request.user.id,...request.body}));
  fastify.post('/topics/:topicId/cancel',{...auth,schema:{params:topicParams}},request=>fastify.seo.cancel(request.params.topicId,request.user.id));
  fastify.get('/admin',admin,async()=>({
    ...await fastify.seo.products(),
    snapshots:await rows(sql`SELECT version,source_id,checksum,valid_until,accepted_at FROM ops_price_snapshots ORDER BY version DESC LIMIT 20`),
    schedule:await rows(sql`SELECT p.*,s.source_id,s.valid_until FROM seo_products p JOIN ops_price_snapshots s ON s.version=p.snapshot_version WHERE p.snapshot_version=(SELECT max(version) FROM ops_price_snapshots) ORDER BY p.product_id,p.effective_at`),
    syncs:await rows(sql`SELECT * FROM ops_price_syncs ORDER BY created_at DESC LIMIT 20`),
    purchases:await rows(sql`SELECT p.*,e.id AS entitlement_id,e.starts_at,e.expires_at,e.status FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id ORDER BY p.created_at DESC LIMIT 100`),
    events:await rows(sql`SELECT * FROM seo_events ORDER BY created_at DESC LIMIT 100`),
    serverNow:(await rows(sql`SELECT clock_timestamp() AS now`))[0].now,
    sourceConfigured:Boolean(process.env.OPS_PRICE_TRUST_KEY_FILE&&process.env.OPS_PRICE_SNAPSHOT_FILE&&process.env.OPS_PRICE_SOURCE_ID),
  }));
  fastify.put('/admin/topics/:topicId/eligibility',{preHandler:[fastify.requirePermission('editorial.classify')],schema:{params:topicParams,body:object({allowed:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:500}},['allowed','reason'])}},request=>fastify.seo.reserve(request.params.topicId,request.user.id,request.body.allowed,request.body.reason));
  fastify.post('/admin/purchases/:id/correct',{preHandler:[fastify.requirePermission('dashboard.ledger')],schema:{params:object({id:{type:'string',format:'uuid'}},['id']),body:object({reason:{type:'string',minLength:10,maxLength:500},idempotencyKey:{type:'string',minLength:16,maxLength:100}},['reason','idempotencyKey'])}},request=>fastify.seo.correct(request.params.id,request.user.id,request.body.reason,request.body.idempotencyKey));
  fastify.post('/admin/reconcile',admin,async()=>({expired:await fastify.seo.expire()}));
  fastify.addHook('onSend',async(request,reply,payload)=>{reply.header('Cache-Control','private, no-store, max-age=0');return payload;});
}
