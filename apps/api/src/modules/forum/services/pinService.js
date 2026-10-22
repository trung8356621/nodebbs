import crypto from 'node:crypto';
import {sql,eq,and,asc} from 'drizzle-orm';
import db,{atomicWrite} from '#core/db/index.js';
import {shopItems} from '#core/db/schema.js';
import {DEFAULT_CURRENCY_CODE} from '#core/extensions/ledger/constants.js';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
// Use the ambient transaction connection; concurrent purchases must not exhaust
// the pool waiting for a second policy-inspection connection.
const policyClient={query:(text,values=[])=>db.execute(sql.join(text.split(/(\$\d+)/g).filter(Boolean).map(part=>/^\$\d+$/.test(part)?sql`${values[Number(part.slice(1))-1]}`:sql.raw(part)),sql``))};
export const rows=async statement=>(await db.execute(statement)).rows;
export const paidActive=sql`EXISTS(SELECT 1 FROM pin_entitlements pe WHERE pe.topic_id=${sql.raw('topics.id')} AND pe.status='active' AND pe.starts_at<=statement_timestamp() AND pe.ends_at>statement_timestamp())`;
export const effectivePinned=sql`(${sql.raw('topics.is_pinned')} OR ${paidActive})`;
export const pinExpiresAt=sql`(SELECT max(pe.ends_at) FROM pin_entitlements pe WHERE pe.topic_id=${sql.raw('topics.id')} AND pe.status='active' AND pe.ends_at>statement_timestamp())`;
export const effectiveLinkPolicy=sql`CASE WHEN EXISTS(SELECT 1 FROM topic_link_classifications c WHERE c.topic_id=topics.id AND c.advertising) THEN 'sponsored' WHEN EXISTS(SELECT 1 FROM topic_link_classifications c WHERE c.topic_id=topics.id AND c.editorial) AND NOT EXISTS(SELECT 1 FROM pin_entitlements e WHERE e.topic_id=topics.id) THEN 'editorial' WHEN ${paidActive} THEN 'paid' ELSE 'ugc' END`;
export function validateProduct(body){
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100||!Number.isSafeInteger(body.price)||body.price<1||body.price>1000000000||!Number.isInteger(body.durationSeconds)||body.durationSeconds<60||body.durationSeconds>31536000)throw fail('Invalid pin product');
  return {type:'topic_pin',consumeType:'consumable',name:body.name.trim(),price:body.price,currencyCode:DEFAULT_CURRENCY_CODE,isActive:body.enabled!==false,displayOrder:Number.isInteger(body.displayOrder)?body.displayOrder:0,metadata:JSON.stringify({durationSeconds:body.durationSeconds})};
}
export class PinService {
  constructor(fastify){this.fastify=fastify;}
  async plans(){return (await db.select().from(shopItems).where(and(eq(shopItems.type,'topic_pin'),eq(shopItems.isActive,true))).orderBy(asc(shopItems.displayOrder),asc(shopItems.id))).map(p=>({...p,durationSeconds:JSON.parse(p.metadata||'{}').durationSeconds}));}
  async lockTopic(id){
    await db.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext('pbn-policy'))`);
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pbn-content'),hashtext(${`topic:${id}`}))`);
    const [topic]=await rows(sql`SELECT t.*,p.content,p.approval_status AS post_approval,p.is_deleted AS post_deleted,u.is_banned,u.is_deleted AS author_deleted FROM topics t JOIN posts p ON p.topic_id=t.id AND p.post_number=1 JOIN users u ON u.id=t.user_id WHERE t.id=${id} FOR UPDATE OF t,p`);
    if(!topic)throw fail('Topic not found',404);return topic;
  }
  async eligible(topic,userId){
    if(topic.user_id!==userId)throw fail('Only the topic owner may purchase a pin',403);
    if(topic.is_deleted||topic.post_deleted||topic.approval_status!=='approved'||topic.post_approval!=='approved'||topic.is_banned||topic.author_deleted)throw fail('Topic is not eligible for paid placement',409);
    const decision=await this.fastify.policy.inspect(topic.title+'\n'+topic.content,'pin_purchase',topic.id,userId,policyClient);
    if(decision.action!=='ALLOW')throw fail('Topic is not eligible for paid placement',422);
  }
  async purchase({userId,topicId,productId,idempotencyKey,expectedPrice,expectedDuration}){
    if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey))throw fail('Invalid idempotency key');
    const hash=crypto.createHash('sha256').update(JSON.stringify({topicId,productId,expectedPrice,expectedDuration})).digest('hex');
    return atomicWrite(async()=>{
      await db.execute(sql`SET LOCAL lock_timeout='10s'`);
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pin-purchase'),hashtext(${userId+':'+idempotencyKey}))`);
      const [prior]=await rows(sql`SELECT * FROM pin_entitlements WHERE user_id=${userId} AND idempotency_key=${idempotencyKey}`);
      if(prior){if(prior.payload_hash!==hash)throw fail('Idempotency key conflicts with an earlier purchase',409);return prior;}
      const topic=await this.lockTopic(topicId);await this.eligible(topic,userId);
      const [product]=await db.select().from(shopItems).where(eq(shopItems.id,productId)).for('update');
      if(!product||product.type!=='topic_pin'||!product.isActive||product.currencyCode!==DEFAULT_CURRENCY_CODE)throw fail('Pin product is unavailable',409);
      const duration=JSON.parse(product.metadata||'{}').durationSeconds;validateProduct({name:product.name,price:product.price,durationSeconds:duration});
      if((expectedPrice!==undefined&&expectedPrice!==product.price)||(expectedDuration!==undefined&&expectedDuration!==duration))throw fail('Pin plan changed; review the current price and duration',409);
      if(!await this.fastify.ledger.isCurrencyActive(DEFAULT_CURRENCY_CODE))throw fail('Credit is unavailable',409);
      const id=crypto.randomUUID();
      const transaction=await this.fastify.ledger.deduct({userId,amount:product.price,currencyCode:DEFAULT_CURRENCY_CODE,type:'pin_purchase',referenceType:'pin_entitlement',referenceId:id,description:'Paid topic pin: '+product.name,metadata:{entitlementId:id,topicId,productId,durationSeconds:duration,idempotencyKey,source:'topic-owner'}});
      const [clock]=await rows(sql`SELECT clock_timestamp() AS now,coalesce(max(ends_at),clock_timestamp()) AS previous_end FROM pin_entitlements WHERE topic_id=${topicId} AND status='active' AND ends_at>clock_timestamp()`);
      const [entitlement]=await rows(sql`INSERT INTO pin_entitlements(id,topic_id,user_id,product_id,transaction_id,idempotency_key,payload_hash,price,duration_seconds,balance_before,balance_after,starts_at,ends_at)
        VALUES(${id},${topicId},${userId},${productId},${transaction.id},${idempotencyKey},${hash},${product.price},${duration},${Number(transaction.balanceAfter)+product.price},${transaction.balanceAfter},greatest(${clock.now}::timestamptz,${clock.previous_end}::timestamptz),greatest(${clock.now}::timestamptz,${clock.previous_end}::timestamptz)+${duration}*interval '1 second') RETURNING *`);
      await db.execute(sql`INSERT INTO pin_events(id,entitlement_id,topic_id,type,actor_id,reason,metadata) VALUES(${crypto.randomUUID()},${id},${topicId},'purchase',${userId},'Owner confirmed non-refundable paid pin',${JSON.stringify({transactionId:transaction.id,price:product.price,productId})}::jsonb)`);
      return entitlement;
    });
  }
  async cancel(topicId,userId){return atomicWrite(async()=>{
    const t=await this.lockTopic(topicId);if(t.user_id!==userId)throw fail('Only the topic owner may cancel a paid pin',403);
    const changed=await rows(sql`UPDATE pin_entitlements SET status='cancelled',reason='Owner cancelled without refund' WHERE topic_id=${topicId} AND status='active' AND ends_at>clock_timestamp() RETURNING id`);
    for(const e of changed)await db.execute(sql`INSERT INTO pin_events(id,entitlement_id,topic_id,type,actor_id,reason) VALUES(${crypto.randomUUID()},${e.id},${topicId},'cancel',${userId},'Owner cancelled without refund') ON CONFLICT DO NOTHING`);
    return {cancelled:changed.length};
  });}
  async correct(id,actorId,reason,key){
    if(typeof reason!=='string'||reason.trim().length<10||reason.length>500||typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw fail('A reason and idempotency key are required');
    return atomicWrite(async()=>{
      const [ref]=await rows(sql`SELECT topic_id FROM pin_entitlements WHERE id=${id}::uuid`);if(!ref)throw fail('Purchase not found',404);
      await this.lockTopic(ref.topic_id);
      const [e]=await rows(sql`SELECT * FROM pin_entitlements WHERE id=${id}::uuid FOR UPDATE`);
      const [prior]=await rows(sql`SELECT * FROM pin_events WHERE entitlement_id=${id}::uuid AND type='correction'`);
      if(prior){if(prior.metadata.key!==key||prior.reason!==reason)throw fail('This purchase already has a technical correction',409);return prior;}
      const tx=await this.fastify.ledger.grant({userId:e.user_id,amount:Number(e.price),currencyCode:DEFAULT_CURRENCY_CODE,type:'pin_correction',referenceType:'pin_entitlement',referenceId:id,description:'Technical pin correction',metadata:{actorId,reason,originalTransactionId:e.transaction_id,key}});
      await db.execute(sql`UPDATE pin_entitlements SET status='cancelled',reason=${reason} WHERE id=${id}::uuid`);
      const [event]=await rows(sql`INSERT INTO pin_events(id,entitlement_id,topic_id,type,actor_id,reason,metadata) VALUES(${crypto.randomUUID()},${id}::uuid,${e.topic_id},'correction',${actorId},${reason},${JSON.stringify({transactionId:tx.id,originalTransactionId:e.transaction_id,key})}::jsonb) RETURNING *`);return event;
    });
  }
  async classify(topicId,actorId,{editorial,advertising,reason}){
    if(typeof editorial!=='boolean'||typeof advertising!=='boolean'||typeof reason!=='string'||reason.trim().length<10||reason.length>500)throw fail('Editorial review requires an explicit reason');
    return atomicWrite(async()=>{
      const t=await this.lockTopic(topicId);
      const [old]=await rows(sql`SELECT * FROM topic_link_classifications WHERE topic_id=${topicId}`);
      if(old?.advertising&&!advertising)throw fail('Advertising classification cannot be removed by editorial review',409);
      if(editorial){if(advertising||t.is_deleted||t.post_deleted||t.is_banned||t.author_deleted||t.post_approval!=='approved'||t.approval_status!=='approved'||(await rows(sql`SELECT 1 FROM pin_entitlements WHERE topic_id=${topicId} LIMIT 1`)).length)throw fail('Commercial content cannot receive independent editorial links',409);const d=await this.fastify.policy.inspect(t.title+'\n'+t.content,'editorial_review',topicId,actorId,policyClient);if(d.action!=='ALLOW')throw fail('Content is not eligible for editorial classification',422);}
      await db.execute(sql`INSERT INTO topic_link_classifications(topic_id,editorial,advertising,reviewer_id,reason) VALUES(${topicId},${editorial},${advertising},${actorId},${reason}) ON CONFLICT(topic_id) DO UPDATE SET editorial=excluded.editorial,advertising=excluded.advertising,reviewer_id=excluded.reviewer_id,reason=excluded.reason,updated_at=clock_timestamp()`);
      await db.execute(sql`INSERT INTO pin_events(id,topic_id,type,actor_id,reason,metadata) VALUES(${crypto.randomUUID()},${topicId},'classification',${actorId},${reason},${JSON.stringify({editorial,advertising})}::jsonb)`);return {editorial,advertising};
    });
  }
  async expire(limit=50){return atomicWrite(async()=>{
    const due=await rows(sql`SELECT id,topic_id FROM pin_entitlements WHERE status='active' AND ends_at<=clock_timestamp() ORDER BY ends_at,id LIMIT ${Math.min(100,Math.max(1,limit))} FOR UPDATE SKIP LOCKED`);
    for(const e of due){await db.execute(sql`UPDATE pin_entitlements SET status='expired',reason='Calendar term ended' WHERE id=${e.id}::uuid`);await db.execute(sql`INSERT INTO pin_events(id,entitlement_id,topic_id,type,reason) VALUES(${crypto.randomUUID()},${e.id}::uuid,${e.topic_id},'expire','Calendar term ended; no refund') ON CONFLICT DO NOTHING`);}
    return due.length;
  });}
}
