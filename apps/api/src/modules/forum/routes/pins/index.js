import {eq,sql} from 'drizzle-orm';
import db from '#core/db/index.js';
import {shopItems} from '#core/db/schema.js';
import {rows} from '../../services/pinService.js';
import {seoError} from '../../services/seo/errors.js';

export default async function pinRoutes(fastify){
  fastify.setErrorHandler((error,request,reply)=>{
    const safe=seoError(error);
    if(safe.status===500)fastify.log.error({err:error,topicId:request.params?.topicId},'Paid pin checkout failed');
    reply.code(safe.status).send({code:safe.code,message:safe.status===500?'Paid pin checkout is temporarily unavailable; please try again':safe.message});
  });

  // Legacy shop-item product CRUD retired — configure via /api/forum/local-pricing.
  fastify.addHook('onRequest',async(request,reply)=>{
    if((request.method==='POST'||request.method==='PUT')&&request.url.includes('/admin/products')){
      return reply.code(410).send({
        error:'Pin prices are configured under Forum local pricing (/dashboard/ledger?tab=services)',
        code:'USE_LOCAL_PRICING',
      });
    }
  });

  const auth={preHandler:[fastify.authenticate]};
  // ledger consolidation: commercial admin uses dashboard.extensions (dashboard.shop was never seeded)
  const admin={preHandler:[fastify.requirePermission('dashboard.extensions')]};
  const body=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
  const topicParams={type:'object',properties:{topicId:{type:'integer',minimum:1}},required:['topicId']};

  fastify.get('/products',async()=>{
    const plans=await fastify.pins.plans();
    const authority=plans[0]?.pricingAuthority||'forum-local';
    return {
      pricingAuthority:authority,
      note:'paid_pin uses Forum-local base price with optional OPS override/ban and Free Mode',
      plans,
    };
  });

  fastify.get('/me',auth,async request=>({
    balance:(await fastify.ledger.getAccount(request.user.id,'credits')).balance,
    purchases:await rows(sql`SELECT * FROM pin_entitlements WHERE user_id=${request.user.id} ORDER BY created_at DESC LIMIT 100`),
  }));

  fastify.get('/topics/:topicId',{...auth,schema:{params:topicParams}},async(request,reply)=>{
    const [t]=await rows(sql`SELECT id,user_id FROM topics WHERE id=${request.params.topicId}`);
    if(!t)return reply.code(404).send({error:'Topic not found'});
    if(t.user_id!==request.user.id&&!await fastify.permission.can(request,'dashboard.extensions')){
      return reply.code(403).send({error:'Only the topic owner may inspect purchases'});
    }
    return {
      purchases:await rows(sql`SELECT * FROM pin_entitlements WHERE topic_id=${t.id} ORDER BY created_at DESC LIMIT 100`),
      balance:(await fastify.ledger.getAccount(request.user.id,'credits')).balance,
    };
  });

  fastify.post('/topics/:topicId/purchase',{
    ...auth,
    schema:{
      params:topicParams,
      body:body({
        skuCode:{type:'string',pattern:'^[-a-zA-Z0-9_]{1,80}$'},
        productId:{type:'string',pattern:'^[-a-zA-Z0-9_]{1,80}$'},
        expectedPrice:{type:'integer',minimum:0},
        expectedDuration:{type:'integer',minimum:60},
        idempotencyKey:{type:'string',minLength:16,maxLength:100},
      },['idempotencyKey']),
    },
  },async request=>{
    await fastify.permission.check(request,'topic.read');
    return fastify.pins.purchase({
      userId:request.user.id,
      topicId:request.params.topicId,
      skuCode:request.body.skuCode||request.body.productId,
      expectedPrice:request.body.expectedPrice,
      expectedDuration:request.body.expectedDuration,
      idempotencyKey:request.body.idempotencyKey,
    });
  });

  fastify.post('/topics/:topicId/cancel',{...auth,schema:{params:topicParams}},request=>fastify.pins.cancel(request.params.topicId,request.user.id));

  fastify.get('/admin',admin,async()=>({
    pricingAuthority:'forum-local',
    catalogPlans:await fastify.pins.plans().catch((err)=>({error:err.message,code:err.code})),
    legacyShopItems:await db.select().from(shopItems).where(eq(shopItems.type,'topic_pin')),
    entitlements:await rows(sql`SELECT * FROM pin_entitlements ORDER BY created_at DESC LIMIT 100`),
    events:await rows(sql`SELECT * FROM pin_events ORDER BY created_at DESC LIMIT 100`),
  }));

  fastify.post('/admin/reconcile',admin,async()=>({expired:await fastify.pins.expire()}));
  fastify.post('/admin/entitlements/:id/correct',{
    preHandler:[fastify.requirePermission('dashboard.ledger')],
    schema:{
      params:body({id:{type:'string',format:'uuid'}},['id']),
      body:body({reason:{type:'string',minLength:10,maxLength:500},idempotencyKey:{type:'string',minLength:16,maxLength:100}},['reason','idempotencyKey']),
    },
  },request=>fastify.pins.correct(request.params.id,request.user.id,request.body.reason,request.body.idempotencyKey));

  fastify.put('/admin/topics/:topicId/classification',{
    preHandler:[fastify.requirePermission('editorial.classify')],
    schema:{
      params:topicParams,
      body:body({editorial:{type:'boolean'},advertising:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:500}},['editorial','advertising','reason']),
    },
  },request=>fastify.pins.classify(request.params.topicId,request.user.id,request.body));

  fastify.addHook('onSend',async(request,reply,payload)=>{
    reply.header('Cache-Control','private, no-store, max-age=0');
    return payload;
  });
}
