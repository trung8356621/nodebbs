import crypto from 'node:crypto';
import {sql} from 'drizzle-orm';
import db,{atomicWrite} from '#core/db/index.js';
import {rows} from '../pinService.js';
import {CREDIT_VND,BUSINESS_TIME_ZONE,QUOTE_SECONDS} from './constants.js';
const fail=(message,code=409)=>Object.assign(new Error(message),{statusCode:code});
const iso=v=>v?new Date(v).toISOString():null;
export function priceSnapshot(p){return {productId:p.product_id,name:p.name,type:p.type,snapshotVersion:p.snapshot_version,priceVersion:p.price_version,sourceId:p.source_id,checksum:p.checksum,durationMonths:p.duration_months,listPriceCredit:Number(p.list_price),salePriceCredit:Number(p.sale_price),effectiveAt:iso(p.effective_at),endsAt:iso(p.ends_at),snapshotValidUntil:iso(p.valid_until),renewalWindowDays:p.renewal_window_days,discount:p.discount};}
export class SeoService{
  constructor(fastify){this.fastify=fastify;}
  async products(){const products=await rows(sql`SELECT p.*,s.source_id,s.checksum,s.valid_until FROM seo_products p JOIN ops_price_snapshots s ON s.version=p.snapshot_version WHERE s.version=(SELECT max(version) FROM ops_price_snapshots) AND s.valid_until>statement_timestamp() AND p.enabled AND p.effective_at<=statement_timestamp() AND (p.ends_at IS NULL OR p.ends_at>statement_timestamp()) ORDER BY p.product_id`);return {creditVnd:CREDIT_VND,businessTimeZone:BUSINESS_TIME_ZONE,products:products.map(priceSnapshot)};}
  async product(id,now){const [p]=await rows(sql`SELECT p.*,s.source_id,s.checksum,s.valid_until FROM seo_products p JOIN ops_price_snapshots s ON s.version=p.snapshot_version WHERE s.version=(SELECT max(version) FROM ops_price_snapshots) AND s.valid_until>${now}::timestamptz AND p.product_id=${id} AND p.enabled AND p.effective_at<=${now}::timestamptz AND (p.ends_at IS NULL OR p.ends_at>${now}::timestamptz)`);if(!p)throw fail('No authorized current SEO price is available');return priceSnapshot(p);}
  async eligible(topic,userId){if(!topic.seo_purchase_allowed)throw fail('SEO purchases are disabled for this reserved topic');await this.fastify.pins.eligible(topic,userId,'seo_purchase');}
  async renewal(topicId,now,window){const [row]=await rows(sql`SELECT max(expires_at) AS expires_at FROM seo_entitlements WHERE topic_id=${topicId} AND status='active' AND expires_at>${now}::timestamptz`);if(row.expires_at&&new Date(row.expires_at)-new Date(now)>window*86400000)throw fail('Renewal is not yet eligible; wait for the authorized renewal window');return row.expires_at||now;}
  async quote(topicId,userId,productId){return atomicWrite(async()=>{
    await db.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext('pbn-seo-prices'))`);const topic=await this.fastify.pins.lockTopic(topicId);await this.eligible(topic,userId);
    const [{now}]=await rows(sql`SELECT clock_timestamp() AS now`);const p=await this.product(productId,now);await this.renewal(topicId,now,p.renewalWindowDays);
    const [q]=await rows(sql`INSERT INTO seo_quotes(id,user_id,topic_id,product_id,price_snapshot,expires_at,created_at) VALUES(${crypto.randomUUID()}::uuid,${userId},${topicId},${productId},${JSON.stringify(p)}::jsonb,least(${now}::timestamptz+${QUOTE_SECONDS}*interval '1 second',${p.snapshotValidUntil}::timestamptz,coalesce(${p.endsAt}::timestamptz,'infinity'::timestamptz)),${now}::timestamptz) RETURNING *`);return {...q,creditVnd:CREDIT_VND};
  });}
  async receipt(id){const [p]=await rows(sql`SELECT p.*,e.id AS entitlement_id,e.starts_at,e.expires_at,e.status,e.reason FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id WHERE p.id=${id}::uuid`);return p;}
  async history(topicId,userId){const [t]=await rows(sql`SELECT user_id,seo_purchase_allowed FROM topics WHERE id=${topicId}`);if(!t)throw fail('Topic not found',404);if(t.user_id!==userId)throw fail('Only the topic owner may inspect SEO purchases',403);return {allowed:t.seo_purchase_allowed,balance:(await this.fastify.ledger.getAccount(userId,'credits')).balance,purchases:await rows(sql`SELECT p.*,e.id AS entitlement_id,e.starts_at,e.expires_at,e.status,e.reason FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id WHERE p.topic_id=${topicId} ORDER BY p.created_at DESC LIMIT 100`)};}
  async purchase({topicId,userId,quoteId,idempotencyKey}){
    if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey))throw fail('Invalid idempotency key',400);
    const hash=crypto.createHash('sha256').update(JSON.stringify({topicId,quoteId})).digest('hex');
    return atomicWrite(async()=>{
      await db.execute(sql`SET LOCAL lock_timeout='10s'`);await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('seo-purchase'),hashtext(${userId+':'+idempotencyKey}))`);
      const [old]=await rows(sql`SELECT id,payload_hash FROM seo_purchases WHERE user_id=${userId} AND idempotency_key=${idempotencyKey}`);if(old){if(old.payload_hash!==hash)throw fail('Idempotency key conflicts with an earlier purchase');return this.receipt(old.id);}
      await db.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext('pbn-seo-prices'))`);const topic=await this.fastify.pins.lockTopic(topicId);await this.eligible(topic,userId);
      const [q]=await rows(sql`SELECT * FROM seo_quotes WHERE id=${quoteId}::uuid AND user_id=${userId} AND topic_id=${topicId} FOR UPDATE`);if(!q)throw fail('SEO quote is invalid or belongs to another user');
      if((await rows(sql`SELECT 1 FROM seo_purchases WHERE quote_id=${quoteId}::uuid`)).length)throw fail('This SEO quote was already used');
      const account=await this.fastify.ledger.getAccount(userId,'credits');const [{now}]=await rows(sql`SELECT clock_timestamp() AS now`);
      const price=await this.product(q.product_id,now);
      if(new Date(q.expires_at)<=new Date(now)||price.snapshotVersion!==q.price_snapshot.snapshotVersion||price.priceVersion!==q.price_snapshot.priceVersion)throw fail('SEO price changed or quote expired; confirm a new quote');
      if(!await this.fastify.ledger.isCurrencyActive('credits'))throw fail('Credit is unavailable');
      const start=await this.renewal(topicId,now,price.renewalWindowDays);const id=crypto.randomUUID(),entitlementId=crypto.randomUUID();
      const metadata={purchaseId:id,entitlementId,topicId,productId:price.productId,priceVersion:price.priceVersion,snapshotVersion:price.snapshotVersion,listPrice:price.listPriceCredit,salePrice:price.salePriceCredit,idempotencyKey,sourceId:price.sourceId};
      let tx=null;if(price.salePriceCredit>0)tx=await this.fastify.ledger.deduct({userId,amount:price.salePriceCredit,currencyCode:'credits',type:'seo_purchase',referenceType:'seo_entitlement',referenceId:entitlementId,description:'Monthly SEO entitlement',metadata});
      const snapshot={...price,acceptedAt:iso(now)};const balanceAfter=tx?Number(tx.balanceAfter):Number(account.balance);
      await db.execute(sql`INSERT INTO seo_purchases(id,user_id,topic_id,quote_id,product_id,snapshot_version,price_version,list_price,paid_price,duration_months,price_snapshot,transaction_id,balance_before,balance_after,idempotency_key,payload_hash,created_at) VALUES(${id}::uuid,${userId},${topicId},${quoteId}::uuid,${price.productId},${price.snapshotVersion},${price.priceVersion},${price.listPriceCredit},${price.salePriceCredit},${price.durationMonths},${JSON.stringify(snapshot)}::jsonb,${tx?.id||null},${account.balance},${balanceAfter},${idempotencyKey},${hash},clock_timestamp())`);
      await db.execute(sql`INSERT INTO seo_entitlements(id,purchase_id,topic_id,user_id,starts_at,expires_at) VALUES(${entitlementId}::uuid,${id}::uuid,${topicId},${userId},${start}::timestamptz,pbn_seo_add_months(${start}::timestamptz,${price.durationMonths}))`);
      await this.event(id,topicId,'purchase',userId,'Owner explicitly confirmed SEO activation',metadata);return this.receipt(id);
    });
  }
  async event(purchaseId,topicId,type,actorId,reason,metadata={}){await db.execute(sql`INSERT INTO seo_events(id,purchase_id,topic_id,type,actor_id,reason,metadata) VALUES(${crypto.randomUUID()}::uuid,${purchaseId}::uuid,${topicId},${type},${actorId},${reason},${JSON.stringify(metadata)}::jsonb) ON CONFLICT DO NOTHING`);}
  async cancel(topicId,userId){return atomicWrite(async()=>{const t=await this.fastify.pins.lockTopic(topicId);if(t.user_id!==userId)throw fail('Only the topic owner may cancel SEO activation',403);const es=await rows(sql`UPDATE seo_entitlements SET status='cancelled',reason='Owner deactivated without refund' WHERE topic_id=${topicId} AND status='active' AND expires_at>clock_timestamp() RETURNING purchase_id`);for(const e of es)await this.event(e.purchase_id,topicId,'cancel',userId,'Owner deactivated without refund');return {cancelled:es.length};});}
  async reserve(topicId,actorId,allowed,reason){if(typeof allowed!=='boolean'||typeof reason!=='string'||reason.trim().length<10||reason.length>500)throw fail('SEO restriction requires an explicit reason',400);return atomicWrite(async()=>{await this.fastify.pins.lockTopic(topicId);await db.execute(sql`UPDATE topics SET seo_purchase_allowed=${allowed} WHERE id=${topicId}`);await this.event(null,topicId,'restriction',actorId,reason,{allowed});return {allowed};});}
  async correct(id,actorId,reason,key){
    if(typeof reason!=='string'||reason.trim().length<10||reason.length>500||typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw fail('A reason and idempotency key are required',400);
    return atomicWrite(async()=>{const p=await this.receipt(id);if(!p)throw fail('Purchase not found',404);await this.fastify.pins.lockTopic(p.topic_id);const [old]=await rows(sql`SELECT * FROM seo_events WHERE purchase_id=${id}::uuid AND type='correction'`);if(old){if(old.metadata.key!==key||old.reason!==reason)throw fail('This purchase already has a technical correction');return old;}
      let tx=null;if(Number(p.paid_price)>0)tx=await this.fastify.ledger.grant({userId:p.user_id,amount:Number(p.paid_price),currencyCode:'credits',type:'seo_correction',referenceType:'seo_purchase',referenceId:id,description:'Technical SEO correction',metadata:{actorId,reason,originalTransactionId:p.transaction_id,key}});
      await db.execute(sql`UPDATE seo_entitlements SET status='cancelled',reason=${reason} WHERE purchase_id=${id}::uuid`);await this.event(id,p.topic_id,'correction',actorId,reason,{key,transactionId:tx?.id||null,originalTransactionId:p.transaction_id});return {purchaseId:id,transactionId:tx?.id||null};
    });
  }
  async expire(){return atomicWrite(async()=>{const due=await rows(sql`SELECT id,purchase_id,topic_id FROM seo_entitlements WHERE status='active' AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT 50 FOR UPDATE SKIP LOCKED`);for(const e of due){await db.execute(sql`UPDATE seo_entitlements SET status='expired',reason='Calendar SEO term ended' WHERE id=${e.id}::uuid`);await this.event(e.purchase_id,e.topic_id,'expire',null,'Calendar SEO term ended; no refund');}return due.length;});}
}
