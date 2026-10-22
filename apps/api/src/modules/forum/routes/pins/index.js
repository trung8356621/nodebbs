import {eq,sql} from 'drizzle-orm';
import db from '#core/db/index.js';
import {shopItems} from '#core/db/schema.js';
import {rows,validateProduct} from '../../services/pinService.js';
export default async function pinRoutes(fastify){
  const auth={preHandler:[fastify.authenticate]};
  const admin={preHandler:[fastify.requirePermission('dashboard.shop')]};
  const body=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
  const topicParams={type:'object',properties:{topicId:{type:'integer',minimum:1}},required:['topicId']};
  fastify.get('/products',async()=>fastify.pins.plans());
  fastify.get('/me',auth,async request=>({balance:(await fastify.ledger.getAccount(request.user.id,'credits')).balance,purchases:await rows(sql`SELECT * FROM pin_entitlements WHERE user_id=${request.user.id} ORDER BY created_at DESC LIMIT 100`)}));
  fastify.get('/topics/:topicId',{...auth,schema:{params:topicParams}},async(request,reply)=>{
    const [t]=await rows(sql`SELECT id,user_id FROM topics WHERE id=${request.params.topicId}`);if(!t)return reply.code(404).send({error:'Topic not found'});
    if(t.user_id!==request.user.id&&!await fastify.permission.can(request,'dashboard.shop'))return reply.code(403).send({error:'Only the topic owner may inspect purchases'});
    return {purchases:await rows(sql`SELECT * FROM pin_entitlements WHERE topic_id=${t.id} ORDER BY created_at DESC LIMIT 100`),balance:(await fastify.ledger.getAccount(request.user.id,'credits')).balance};
  });
  fastify.post('/topics/:topicId/purchase',{...auth,schema:{params:topicParams,body:body({productId:{type:'integer',minimum:1},expectedPrice:{type:'integer',minimum:1},expectedDuration:{type:'integer',minimum:60},idempotencyKey:{type:'string',minLength:16,maxLength:100}},['productId','idempotencyKey'])}},async request=>{
    await fastify.permission.check(request,'topic.read');return fastify.pins.purchase({userId:request.user.id,topicId:request.params.topicId,...request.body});
  });
  fastify.post('/topics/:topicId/cancel',{...auth,schema:{params:topicParams}},request=>fastify.pins.cancel(request.params.topicId,request.user.id));
  fastify.get('/admin',admin,async()=>({products:await db.select().from(shopItems).where(eq(shopItems.type,'topic_pin')),entitlements:await rows(sql`SELECT * FROM pin_entitlements ORDER BY created_at DESC LIMIT 100`),events:await rows(sql`SELECT * FROM pin_events ORDER BY created_at DESC LIMIT 100`)}));
  const productBody=body({name:{type:'string'},price:{type:'integer'},durationSeconds:{type:'integer'},enabled:{type:'boolean'},displayOrder:{type:'integer'}},['name','price','durationSeconds']);
  fastify.post('/admin/products',{...admin,schema:{body:productBody}},async request=>(await db.insert(shopItems).values(validateProduct(request.body)).returning())[0]);
  fastify.put('/admin/products/:id',{...admin,schema:{body:productBody,params:body({id:{type:'integer',minimum:1}},['id'])}},async(request,reply)=>{
    const [old]=await db.select().from(shopItems).where(eq(shopItems.id,request.params.id));if(old?.type!=='topic_pin')return reply.code(404).send({error:'Pin product not found'});return (await db.update(shopItems).set(validateProduct(request.body)).where(eq(shopItems.id,old.id)).returning())[0];
  });
  fastify.post('/admin/reconcile',admin,async()=>({expired:await fastify.pins.expire()}));
  fastify.post('/admin/entitlements/:id/correct',{preHandler:[fastify.requirePermission('dashboard.ledger')],schema:{params:body({id:{type:'string',format:'uuid'}},['id']),body:body({reason:{type:'string',minLength:10,maxLength:500},idempotencyKey:{type:'string',minLength:16,maxLength:100}},['reason','idempotencyKey'])}},request=>fastify.pins.correct(request.params.id,request.user.id,request.body.reason,request.body.idempotencyKey));
  fastify.put('/admin/topics/:topicId/classification',{preHandler:[fastify.requirePermission('editorial.classify')],schema:{params:topicParams,body:body({editorial:{type:'boolean'},advertising:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:500}},['editorial','advertising','reason'])}},request=>fastify.pins.classify(request.params.topicId,request.user.id,request.body));
  fastify.addHook('onSend',async(request,reply,payload)=>{reply.header('Cache-Control','private, no-store, max-age=0');return payload;});
}
