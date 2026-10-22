import {pgTable,uuid,integer,text,timestamp,boolean,bigint,jsonb,index,unique,check} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import {users,shopItems,sysTransactions} from '#core/db/schema.js';
import {topics} from './schema.js';
export const pinEntitlements=pgTable('pin_entitlements',{
  id:uuid('id').primaryKey(),topicId:integer('topic_id').notNull().references(()=>topics.id),
  userId:integer('user_id').notNull().references(()=>users.id),productId:integer('product_id').notNull().references(()=>shopItems.id),
  transactionId:integer('transaction_id').notNull().unique().references(()=>sysTransactions.id),
  idempotencyKey:text('idempotency_key').notNull(),payloadHash:text('payload_hash').notNull(),
  price:bigint('price',{mode:'number'}).notNull(),durationSeconds:integer('duration_seconds').notNull(),
  balanceBefore:bigint('balance_before',{mode:'number'}).notNull(),balanceAfter:bigint('balance_after',{mode:'number'}).notNull(),
  startsAt:timestamp('starts_at',{withTimezone:true}).notNull(),endsAt:timestamp('ends_at',{withTimezone:true}).notNull(),
  status:text('status').notNull().default('active'),reason:text('reason'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[unique('pin_entitlements_user_key').on(t.userId,t.idempotencyKey),index('pin_entitlements_topic_idx').on(t.topicId,t.status,t.endsAt),index('pin_entitlements_expiry_idx').on(t.status,t.endsAt),check('pin_entitlements_valid',sql`${t.endsAt}>${t.startsAt} AND ${t.price}>0 AND ${t.durationSeconds}>0 AND ${t.balanceAfter}>=0 AND ${t.status} IN ('active','expired','cancelled')`)]);
export const pinEvents=pgTable('pin_events',{
  id:uuid('id').primaryKey(),entitlementId:uuid('entitlement_id').references(()=>pinEntitlements.id),topicId:integer('topic_id').notNull().references(()=>topics.id),
  type:text('type').notNull(),actorId:integer('actor_id').references(()=>users.id),reason:text('reason').notNull(),metadata:jsonb('metadata'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[unique('pin_events_once').on(t.entitlementId,t.type),index('pin_events_topic_idx').on(t.topicId,t.createdAt)]);
export const topicLinkClassifications=pgTable('topic_link_classifications',{
  topicId:integer('topic_id').primaryKey().references(()=>topics.id),editorial:boolean('editorial').notNull().default(false),
  advertising:boolean('advertising').notNull().default(false),reviewerId:integer('reviewer_id').notNull().references(()=>users.id),
  reason:text('reason').notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
