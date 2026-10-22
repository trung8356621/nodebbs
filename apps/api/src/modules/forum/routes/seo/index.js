import {sql} from 'drizzle-orm';
import {rows} from '../../services/pinService.js';
export default async function seoRoutes(fastify){
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
