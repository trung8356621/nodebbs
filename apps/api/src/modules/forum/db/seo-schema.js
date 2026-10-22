import {pgTable,integer,text,bigint,boolean,timestamp,jsonb,uuid,primaryKey,unique,index,check} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import {users,sysTransactions} from '#core/db/schema.js';
import {topics} from './schema.js';
const time=name=>timestamp(name,{withTimezone:true});
export const opsPriceSnapshots=pgTable('ops_price_snapshots',{
  version:integer('version').primaryKey(),sourceId:text('source_id').notNull(),checksum:text('checksum').notNull(),
  payload:jsonb('payload').notNull(),validUntil:time('valid_until').notNull(),acceptedAt:time('accepted_at').notNull().defaultNow(),
});
export const seoProducts=pgTable('seo_products',{
  snapshotVersion:integer('snapshot_version').notNull().references(()=>opsPriceSnapshots.version),productId:text('product_id').notNull(),priceVersion:integer('price_version').notNull(),
  name:text('name').notNull(),type:text('type').notNull(),durationMonths:integer('duration_months').notNull(),listPrice:bigint('list_price',{mode:'number'}).notNull(),salePrice:bigint('sale_price',{mode:'number'}).notNull(),
  enabled:boolean('enabled').notNull(),effectiveAt:time('effective_at').notNull(),endsAt:time('ends_at'),renewalWindowDays:integer('renewal_window_days').notNull(),discount:jsonb('discount'),
},t=>[primaryKey({columns:[t.snapshotVersion,t.productId,t.priceVersion]}),index('seo_products_interval_idx').on(t.snapshotVersion,t.productId,t.effectiveAt),check('seo_product_prices',sql`${t.salePrice}>=0 AND ${t.listPrice}>=${t.salePrice} AND ${t.listPrice}<=1000000000 AND ${t.durationMonths} BETWEEN 1 AND 12 AND ${t.renewalWindowDays} BETWEEN 0 AND 14 AND (${t.endsAt} IS NULL OR ${t.endsAt}>${t.effectiveAt})`)]);
export const seoQuotes=pgTable('seo_quotes',{
  id:uuid('id').primaryKey(),userId:integer('user_id').notNull().references(()=>users.id),topicId:integer('topic_id').notNull().references(()=>topics.id),productId:text('product_id').notNull(),
  priceSnapshot:jsonb('price_snapshot').notNull(),expiresAt:time('expires_at').notNull(),createdAt:time('created_at').notNull().defaultNow(),
},t=>[index('seo_quotes_owner_idx').on(t.userId,t.createdAt)]);
export const seoPurchases=pgTable('seo_purchases',{
  id:uuid('id').primaryKey(),userId:integer('user_id').notNull().references(()=>users.id),topicId:integer('topic_id').notNull().references(()=>topics.id),quoteId:uuid('quote_id').notNull().unique().references(()=>seoQuotes.id),
  productId:text('product_id').notNull(),snapshotVersion:integer('snapshot_version').notNull().references(()=>opsPriceSnapshots.version),priceVersion:integer('price_version').notNull(),
  listPrice:bigint('list_price',{mode:'number'}).notNull(),paidPrice:bigint('paid_price',{mode:'number'}).notNull(),durationMonths:integer('duration_months').notNull(),priceSnapshot:jsonb('price_snapshot').notNull(),
  transactionId:integer('transaction_id').unique().references(()=>sysTransactions.id),balanceBefore:bigint('balance_before',{mode:'number'}).notNull(),balanceAfter:bigint('balance_after',{mode:'number'}).notNull(),
  idempotencyKey:text('idempotency_key').notNull(),payloadHash:text('payload_hash').notNull(),createdAt:time('created_at').notNull().defaultNow(),
},t=>[unique('seo_purchase_user_key').on(t.userId,t.idempotencyKey),index('seo_purchase_topic_idx').on(t.topicId,t.createdAt),index('seo_purchase_created_idx').on(t.createdAt),check('seo_purchase_accounting',sql`${t.paidPrice}>=0 AND ${t.listPrice}>=${t.paidPrice} AND ${t.balanceBefore}-${t.paidPrice}=${t.balanceAfter} AND ${t.balanceAfter}>=0 AND ((${t.paidPrice}=0 AND ${t.transactionId} IS NULL) OR (${t.paidPrice}>0 AND ${t.transactionId} IS NOT NULL))`)]);
export const seoEntitlements=pgTable('seo_entitlements',{
  id:uuid('id').primaryKey(),purchaseId:uuid('purchase_id').notNull().unique().references(()=>seoPurchases.id),topicId:integer('topic_id').notNull().references(()=>topics.id),userId:integer('user_id').notNull().references(()=>users.id),
  startsAt:time('starts_at').notNull(),expiresAt:time('expires_at').notNull(),status:text('status').notNull().default('active'),reason:text('reason'),createdAt:time('created_at').notNull().defaultNow(),
},t=>[index('seo_entitlement_topic_idx').on(t.topicId,t.status,t.expiresAt),index('seo_entitlement_due_idx').on(t.status,t.expiresAt),check('seo_entitlement_valid',sql`${t.expiresAt}>${t.startsAt} AND ${t.status} IN ('active','expired','cancelled')`)]);
export const seoEvents=pgTable('seo_events',{
  id:uuid('id').primaryKey(),purchaseId:uuid('purchase_id').references(()=>seoPurchases.id),topicId:integer('topic_id').notNull().references(()=>topics.id),type:text('type').notNull(),actorId:integer('actor_id').references(()=>users.id),reason:text('reason').notNull(),metadata:jsonb('metadata'),createdAt:time('created_at').notNull().defaultNow(),
},t=>[unique('seo_event_once').on(t.purchaseId,t.type),index('seo_events_topic_idx').on(t.topicId,t.createdAt),index('seo_events_created_idx').on(t.createdAt)]);
export const opsPriceSyncs=pgTable('ops_price_syncs',{
  id:uuid('id').primaryKey(),success:boolean('success').notNull(),version:integer('version'),reason:text('reason').notNull(),createdAt:time('created_at').notNull().defaultNow(),
},t=>[index('ops_price_sync_created_idx').on(t.createdAt)]);
