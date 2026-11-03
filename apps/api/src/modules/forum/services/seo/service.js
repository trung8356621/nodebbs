import crypto from 'node:crypto';
import {explicitPermission} from '#core/plugins/rbac/explicitPermission.js';
import {sql} from 'drizzle-orm';
import db,{atomicWrite} from '#core/db/index.js';
import {rows} from '../pinService.js';
import {BUSINESS_TIME_ZONE,QUOTE_SECONDS,QUOTE_STATUS,PRICING_PROVENANCE,PAID_PIN_MIGRATION_STATUS} from './constants.js';
import {catalogMetaFromPayload,productsFromPayload} from './prices.js';

const fail=(message,code=409)=>Object.assign(new Error(message),{statusCode:code});
const iso=v=>v?new Date(v).toISOString():null;

export function priceSnapshot(p){
  return {
    productId:p.product_id,
    name:p.name,
    type:p.type,
    snapshotVersion:p.snapshot_version,
    priceVersion:p.price_version,
    sourceId:p.source_id,
    checksum:p.checksum,
    durationMonths:p.duration_months,
    listPriceCredit:Number(p.list_price),
    salePriceCredit:Number(p.sale_price),
    unitPriceCredit:Number(p.sale_price),
    effectiveAt:iso(p.effective_at),
    endsAt:iso(p.ends_at),
    snapshotValidUntil:iso(p.valid_until),
    renewalWindowDays:p.renewal_window_days,
    discount:p.discount,
  };
}

export class SeoService{
  constructor(fastify){this.fastify=fastify;}

  async activeSnapshot(now=null){
    const clause=now
      ? sql`SELECT version,source_id,checksum,payload,valid_until FROM ops_price_snapshots WHERE version=(SELECT max(version) FROM ops_price_snapshots) AND valid_until>${now}::timestamptz`
      : sql`SELECT version,source_id,checksum,payload,valid_until FROM ops_price_snapshots WHERE version=(SELECT max(version) FROM ops_price_snapshots) AND valid_until>statement_timestamp()`;
    const [snap]=await rows(clause);
    return snap||null;
  }

  async catalogAuthority(){
    // Prefer verified forum-pricing/1 snapshots from OPS (HTTP sync).
    if(this.fastify.forumPricing?.getCatalogView){
      const view=await this.fastify.forumPricing.getCatalogView();
      if(view&&!view.expired){
        return {
          authority:'ops-forum-pricing/1',
          snapshotVersion:view.snapshotVersion,
          sourceId:'ops-forum-pricing',
          checksum:null,
          validUntil:view.validUntil,
          creditVnd:view.creditVnd,
          businessTimeZone:view.businessTimeZone||BUSINESS_TIME_ZONE,
          quoteTtlSeconds:view.quoteTtlSeconds||QUOTE_SECONDS,
          schemaVersion:view.schemaVersion,
          contract:view.contract,
          paidPinMigrationStatus:view.paidPinMigrationStatus||PAID_PIN_MIGRATION_STATUS,
          view,
          payload:null,
        };
      }
    }
    // Legacy file-envelope SEO snapshots (historical / offline fixtures only).
    const snap=await this.activeSnapshot();
    if(!snap)throw fail('No authorized current SEO price is available');
    const meta=catalogMetaFromPayload(snap.payload);
    if(meta.creditVnd==null){
      throw fail('No authorized Credit/VND conversion is available from OPS pricing snapshot');
    }
    return {
      authority:'legacy-seo-envelope',
      snapshotVersion:snap.version,
      sourceId:snap.source_id,
      checksum:snap.checksum,
      validUntil:iso(snap.valid_until),
      creditVnd:meta.creditVnd,
      businessTimeZone:meta.businessTimeZone||BUSINESS_TIME_ZONE,
      quoteTtlSeconds:meta.quoteTtlSeconds||QUOTE_SECONDS,
      schemaVersion:meta.schemaVersion,
      contract:meta.contract,
      paidPinMigrationStatus:PAID_PIN_MIGRATION_STATUS,
      payload:snap.payload,
      view:null,
    };
  }

  async products(){
    const auth=await this.catalogAuthority();
    if(auth.view){
      return {
        creditVnd:auth.creditVnd,
        businessTimeZone:auth.businessTimeZone,
        quoteTtlSeconds:auth.quoteTtlSeconds,
        snapshotVersion:auth.snapshotVersion,
        schemaVersion:auth.schemaVersion,
        contract:auth.contract,
        paidPinMigrationStatus:auth.paidPinMigrationStatus,
        authority:auth.authority,
        freeLaunch:auth.view.freeLaunch,
        products:auth.view.products,
        creditPackages:auth.view.creditPackages,
        paidPins:auth.view.paidPins,
      };
    }
    const products=await rows(sql`
      SELECT p.*,s.source_id,s.checksum,s.valid_until
      FROM seo_products p
      JOIN ops_price_snapshots s ON s.version=p.snapshot_version
      WHERE s.version=${auth.snapshotVersion}
        AND s.valid_until>statement_timestamp()
        AND p.enabled AND p.effective_at<=statement_timestamp()
        AND (p.ends_at IS NULL OR p.ends_at>statement_timestamp())
      ORDER BY p.product_id`);
    const packages=productsFromPayload(auth.payload,'credit_package').filter((p)=>{
      const now=Date.now();
      return p.enabled && Date.parse(p.effectiveAt)<=now && (p.endsAt==null||Date.parse(p.endsAt)>now);
    });
    const paidPins=productsFromPayload(auth.payload,'paid_pin').filter((p)=>{
      const now=Date.now();
      return p.enabled && Date.parse(p.effectiveAt)<=now && (p.endsAt==null||Date.parse(p.endsAt)>now);
    });
    return {
      creditVnd:auth.creditVnd,
      businessTimeZone:auth.businessTimeZone,
      quoteTtlSeconds:auth.quoteTtlSeconds,
      snapshotVersion:auth.snapshotVersion,
      schemaVersion:auth.schemaVersion,
      contract:auth.contract,
      paidPinMigrationStatus:auth.paidPinMigrationStatus,
      authority:auth.authority,
      products:products.map(priceSnapshot),
      creditPackages:packages,
      paidPins,
    };
  }

  async product(id,now){
    if(this.fastify.forumPricing?.getSeoProduct){
      const mapped=await this.fastify.forumPricing.getSeoProduct(id,now);
      if(mapped)return mapped;
    }
    const [p]=await rows(sql`
      SELECT p.*,s.source_id,s.checksum,s.valid_until
      FROM seo_products p
      JOIN ops_price_snapshots s ON s.version=p.snapshot_version
      WHERE s.version=(SELECT max(version) FROM ops_price_snapshots)
        AND s.valid_until>${now}::timestamptz
        AND p.product_id=${id}
        AND p.enabled AND p.effective_at<=${now}::timestamptz
        AND (p.ends_at IS NULL OR p.ends_at>${now}::timestamptz)`);
    if(!p)throw fail('No authorized current SEO price is available');
    return priceSnapshot(p);
  }

  async package(id,now=new Date()){
    if(this.fastify.forumPricing?.getPackage){
      try{return await this.fastify.forumPricing.getPackage(id,now);}catch(err){
        if(err.code!=='unknown_package'&&err.code!=='PRICE_UNAVAILABLE')throw err;
      }
    }
    const auth=await this.catalogAuthority();
    if(auth.view){
      const pack=auth.view.creditPackages.find((p)=>p.id===id||p.code===id);
      if(!pack)throw fail('No authorized current credit package price is available');
      return {
        ...pack,
        snapshotVersion:auth.snapshotVersion,
        pricingVersion:auth.snapshotVersion,
        sourceId:auth.sourceId,
        creditVnd:auth.creditVnd,
        unitPrice:pack.saleAmountVnd,
        quantity:1,
        totalCredits:pack.creditsGranted,
      };
    }
    const pack=productsFromPayload(auth.payload,'credit_package').find((p)=>p.id===id);
    if(!pack||!pack.enabled)throw fail('No authorized current credit package price is available');
    const t=now instanceof Date?now.getTime():Date.parse(now);
    if(Date.parse(pack.effectiveAt)>t||(pack.endsAt&&Date.parse(pack.endsAt)<=t)){
      throw fail('No authorized current credit package price is available');
    }
    return {
      ...pack,
      snapshotVersion:auth.snapshotVersion,
      sourceId:auth.sourceId,
      checksum:auth.checksum,
      creditVnd:auth.creditVnd,
      unitPrice:pack.saleAmountVnd,
      quantity:1,
      totalCredits:pack.creditsGranted,
    };
  }

  async eligible(topic,userId){
    const [{allowed}]=await rows(sql`SELECT ${explicitPermission(userId,'seo.reserved_override')} AS allowed`);
    if(!topic.seo_purchase_allowed&&!allowed)throw fail('SEO purchases are disabled for this reserved topic');
    await this.fastify.pins.eligible(topic,userId,'seo_purchase');
  }

  async renewal(topicId,now,window){
    const [row]=await rows(sql`SELECT max(expires_at) AS expires_at FROM seo_entitlements WHERE topic_id=${topicId} AND status='active' AND expires_at>${now}::timestamptz`);
    if(row.expires_at&&new Date(row.expires_at)-new Date(now)>window*86400000){
      throw fail('Renewal is not yet eligible; wait for the authorized renewal window');
    }
    return row.expires_at||now;
  }

  async quote(topicId,userId,productId){
    return atomicWrite(async()=>{
      await db.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext('pbn-seo-prices'))`);
      const topic=await this.fastify.pins.lockTopic(topicId);
      await this.eligible(topic,userId);
      const [{now}]=await rows(sql`SELECT clock_timestamp() AS now`);
      const auth=await this.catalogAuthority();
      const p=await this.product(productId,now);
      await this.renewal(topicId,now,p.renewalWindowDays);
      const unitPrice=p.unitPriceCredit;
      const quantity=1;
      const totalCredits=unitPrice*quantity;
      const ttl=auth.quoteTtlSeconds||QUOTE_SECONDS;
      const [q]=await rows(sql`
        INSERT INTO seo_quotes(
          id,user_id,topic_id,product_id,price_snapshot,expires_at,created_at,
          unit_price,quantity,total_credits,price_version,credit_vnd,status
        ) VALUES(
          ${crypto.randomUUID()}::uuid,${userId},${topicId},${productId},${JSON.stringify(p)}::jsonb,
          least(${now}::timestamptz+${ttl}*interval '1 second',${p.snapshotValidUntil}::timestamptz,coalesce(${p.endsAt}::timestamptz,'infinity'::timestamptz)),
          ${now}::timestamptz,${unitPrice},${quantity},${totalCredits},${p.priceVersion},${auth.creditVnd},${QUOTE_STATUS.OPEN}
        ) RETURNING *`);
      return {
        ...q,
        quotedAt:iso(q.created_at),
        quoteExpiresAt:iso(q.expires_at),
        unitPrice:Number(q.unit_price),
        quantity:q.quantity,
        totalCredits:Number(q.total_credits),
        creditVnd:q.credit_vnd,
      };
    });
  }

  async receipt(id){
    const [p]=await rows(sql`SELECT p.*,e.id AS entitlement_id,e.starts_at,e.expires_at,e.status,e.reason FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id WHERE p.id=${id}::uuid`);
    return p;
  }

  async history(topicId,userId){
    const [t]=await rows(sql`SELECT user_id,seo_purchase_allowed FROM topics WHERE id=${topicId}`);
    if(!t)throw fail('Topic not found',404);
    if(t.user_id!==userId)throw fail('Only the topic owner may inspect SEO purchases',403);
    const [{override}]=await rows(sql`SELECT ${explicitPermission(userId,'seo.reserved_override')} AS override`);
    return {
      allowed:t.seo_purchase_allowed||override,
      reserved:!t.seo_purchase_allowed,
      internalOverride:override,
      balance:(await this.fastify.ledger.getAccount(userId,'credits')).balance,
      purchases:await rows(sql`SELECT p.*,e.id AS entitlement_id,e.starts_at,e.expires_at,e.status,e.reason FROM seo_purchases p JOIN seo_entitlements e ON e.purchase_id=p.id WHERE p.topic_id=${topicId} ORDER BY p.created_at DESC LIMIT 100`),
    };
  }

  /**
   * Execute purchase against the locked quote snapshot.
   * A newer published catalog must NOT reprice an open unexpired quote.
   */
  async purchase({topicId,userId,quoteId,idempotencyKey}){
    if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey))throw fail('Invalid idempotency key',400);
    const hash=crypto.createHash('sha256').update(JSON.stringify({topicId,quoteId})).digest('hex');
    return atomicWrite(async()=>{
      await db.execute(sql`SET LOCAL lock_timeout='10s'`);
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('seo-purchase'),hashtext(${userId+':'+idempotencyKey}))`);
      const [old]=await rows(sql`SELECT id,payload_hash FROM seo_purchases WHERE user_id=${userId} AND idempotency_key=${idempotencyKey}`);
      if(old){
        if(old.payload_hash!==hash)throw fail('Idempotency key conflicts with an earlier purchase');
        return this.receipt(old.id);
      }
      await db.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext('pbn-seo-prices'))`);
      const topic=await this.fastify.pins.lockTopic(topicId);
      await this.eligible(topic,userId);
      const [q]=await rows(sql`SELECT * FROM seo_quotes WHERE id=${quoteId}::uuid AND user_id=${userId} AND topic_id=${topicId} FOR UPDATE`);
      if(!q)throw fail('SEO quote is invalid or belongs to another user');
      if(q.status===QUOTE_STATUS.REVOKED)throw fail('SEO quote was revoked under emergency policy; confirm a new quote');
      if(q.status===QUOTE_STATUS.CANCELED)throw fail('SEO quote was canceled; confirm a new quote');
      if(q.status===QUOTE_STATUS.CONSUMED||(await rows(sql`SELECT 1 FROM seo_purchases WHERE quote_id=${quoteId}::uuid`)).length){
        throw fail('This SEO quote was already used');
      }
      const account=await this.fastify.ledger.getAccount(userId,'credits');
      const [{now}]=await rows(sql`SELECT clock_timestamp() AS now`);
      if(new Date(q.expires_at)<=new Date(now))throw fail('SEO quote expired; confirm a new quote');

      const locked=q.price_snapshot;
      if(!locked||locked.productId!==q.product_id)throw fail('SEO quote is invalid or belongs to another user');
      const unitPrice=Number(q.unit_price??locked.unitPriceCredit??locked.salePriceCredit);
      const quantity=Number(q.quantity??1);
      const totalCredits=Number(q.total_credits??(unitPrice*quantity));
      if(!Number.isSafeInteger(unitPrice)||!Number.isSafeInteger(quantity)||quantity<1||unitPrice<0||totalCredits!==unitPrice*quantity){
        throw fail('SEO quote is invalid or belongs to another user');
      }
      if(!await this.fastify.ledger.isCurrencyActive('credits'))throw fail('Credit is unavailable');

      const start=await this.renewal(topicId,now,locked.renewalWindowDays);
      const id=crypto.randomUUID();
      const entitlementId=crypto.randomUUID();
      const metadata={
        purchaseId:id,
        entitlementId,
        topicId,
        productId:locked.productId,
        priceVersion:locked.priceVersion,
        snapshotVersion:locked.snapshotVersion,
        unitPrice,
        quantity,
        totalCredits,
        listPrice:locked.listPriceCredit,
        salePrice:locked.salePriceCredit,
        idempotencyKey,
        sourceId:locked.sourceId,
        quotedAt:iso(q.created_at),
        quoteExpiresAt:iso(q.expires_at),
      };
      let tx=null;
      if(totalCredits>0){
        tx=await this.fastify.ledger.deduct({
          userId,
          amount:totalCredits,
          currencyCode:'credits',
          type:'seo_purchase',
          referenceType:'seo_entitlement',
          referenceId:entitlementId,
          description:'Monthly SEO entitlement',
          metadata,
        });
      }
      const snapshot={...locked,unitPriceCredit:unitPrice,acceptedAt:iso(now),executedFromQuote:true};
      const balanceAfter=tx?Number(tx.balanceAfter):Number(account.balance);
      await db.execute(sql`
        INSERT INTO seo_purchases(
          id,user_id,topic_id,quote_id,product_id,snapshot_version,price_version,
          list_price,paid_price,duration_months,price_snapshot,transaction_id,
          balance_before,balance_after,idempotency_key,payload_hash,created_at,
          unit_price,quantity,total_credits,quoted_at,quote_expires_at,pricing_provenance
        ) VALUES(
          ${id}::uuid,${userId},${topicId},${quoteId}::uuid,${locked.productId},
          ${locked.snapshotVersion},${locked.priceVersion},${locked.listPriceCredit},${totalCredits},
          ${locked.durationMonths},${JSON.stringify(snapshot)}::jsonb,${tx?.id||null},
          ${account.balance},${balanceAfter},${idempotencyKey},${hash},clock_timestamp(),
          ${unitPrice},${quantity},${totalCredits},${q.created_at}::timestamptz,${q.expires_at}::timestamptz,
          ${PRICING_PROVENANCE.SNAPSHOT}
        )`);
      await db.execute(sql`UPDATE seo_quotes SET status=${QUOTE_STATUS.CONSUMED} WHERE id=${quoteId}::uuid`);
      await db.execute(sql`INSERT INTO seo_entitlements(id,purchase_id,topic_id,user_id,starts_at,expires_at) VALUES(${entitlementId}::uuid,${id}::uuid,${topicId},${userId},${start}::timestamptz,pbn_seo_add_months(${start}::timestamptz,${locked.durationMonths}))`);
      await this.event(id,topicId,'purchase',userId,'Owner explicitly confirmed SEO activation',metadata);
      return this.receipt(id);
    });
  }

  async revokeQuote(quoteId,actorId,reason){
    if(typeof reason!=='string'||reason.trim().length<10||reason.length>500)throw fail('Emergency quote revocation requires an explicit reason',400);
    return atomicWrite(async()=>{
      const [q]=await rows(sql`SELECT * FROM seo_quotes WHERE id=${quoteId}::uuid FOR UPDATE`);
      if(!q)throw fail('SEO quote is invalid or belongs to another user',404);
      if(q.status===QUOTE_STATUS.CONSUMED)throw fail('This SEO quote was already used');
      if(q.status===QUOTE_STATUS.REVOKED)return q;
      const [updated]=await rows(sql`UPDATE seo_quotes SET status=${QUOTE_STATUS.REVOKED},revoked_at=clock_timestamp(),revoke_reason=${reason} WHERE id=${quoteId}::uuid RETURNING *`);
      await this.event(null,q.topic_id,'quote_revoke',actorId,reason,{quoteId,previousStatus:q.status});
      return updated;
    });
  }

  async event(purchaseId,topicId,type,actorId,reason,metadata={}){
    await db.execute(sql`INSERT INTO seo_events(id,purchase_id,topic_id,type,actor_id,reason,metadata) VALUES(${crypto.randomUUID()}::uuid,${purchaseId}::uuid,${topicId},${type},${actorId},${reason},${JSON.stringify(metadata)}::jsonb) ON CONFLICT DO NOTHING`);
  }

  async cancel(topicId,userId){
    return atomicWrite(async()=>{
      const t=await this.fastify.pins.lockTopic(topicId);
      if(t.user_id!==userId)throw fail('Only the topic owner may cancel SEO activation',403);
      const es=await rows(sql`UPDATE seo_entitlements SET status='cancelled',reason='Owner deactivated without refund' WHERE topic_id=${topicId} AND status='active' AND expires_at>clock_timestamp() RETURNING purchase_id`);
      for(const e of es)await this.event(e.purchase_id,topicId,'cancel',userId,'Owner deactivated without refund');
      return {cancelled:es.length};
    });
  }

  async reserve(topicId,actorId,allowed,reason){
    if(typeof allowed!=='boolean'||typeof reason!=='string'||reason.trim().length<10||reason.length>500)throw fail('SEO restriction requires an explicit reason',400);
    return atomicWrite(async()=>{
      await this.fastify.pins.lockTopic(topicId);
      await db.execute(sql`UPDATE topics SET seo_purchase_allowed=${allowed} WHERE id=${topicId}`);
      await this.event(null,topicId,'restriction',actorId,reason,{allowed});
      return {allowed};
    });
  }

  async correct(id,actorId,reason,key){
    if(typeof reason!=='string'||reason.trim().length<10||reason.length>500||typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw fail('A reason and idempotency key are required',400);
    return atomicWrite(async()=>{
      const p=await this.receipt(id);
      if(!p)throw fail('Purchase not found',404);
      await this.fastify.pins.lockTopic(p.topic_id);
      const [old]=await rows(sql`SELECT * FROM seo_events WHERE purchase_id=${id}::uuid AND type='correction'`);
      if(old){
        if(old.metadata.key!==key||old.reason!==reason)throw fail('This purchase already has a technical correction');
        return old;
      }
      const refundAmount=Number(p.total_credits??p.paid_price);
      let tx=null;
      if(refundAmount>0){
        tx=await this.fastify.ledger.grant({
          userId:p.user_id,
          amount:refundAmount,
          currencyCode:'credits',
          type:'seo_correction',
          referenceType:'seo_purchase',
          referenceId:id,
          description:'Technical SEO correction',
          metadata:{actorId,reason,originalTransactionId:p.transaction_id,key},
        });
      }
      await db.execute(sql`UPDATE seo_entitlements SET status='cancelled',reason=${reason} WHERE purchase_id=${id}::uuid`);
      await this.event(id,p.topic_id,'correction',actorId,reason,{key,transactionId:tx?.id||null,originalTransactionId:p.transaction_id});
      return {purchaseId:id,transactionId:tx?.id||null};
    });
  }

  async expire(){
    return atomicWrite(async()=>{
      const due=await rows(sql`SELECT id,purchase_id,topic_id FROM seo_entitlements WHERE status='active' AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT 50 FOR UPDATE SKIP LOCKED`);
      for(const e of due){
        await db.execute(sql`UPDATE seo_entitlements SET status='expired',reason='Calendar SEO term ended' WHERE id=${e.id}::uuid`);
        await this.event(e.purchase_id,e.topic_id,'expire',null,'Calendar SEO term ended; no refund');
      }
      return due.length;
    });
  }
}
