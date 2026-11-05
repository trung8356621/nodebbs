import {
  pgTable, uuid, integer, varchar, boolean, jsonb, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const forumLocalServices = pgTable('forum_local_services', {
  serviceCode: varchar('service_code', { length: 64 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  basePriceVnd: integer('base_price_vnd').notNull(),
  localPriceVersion: integer('local_price_version').notNull().default(1),
  options: jsonb('options').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
}, (t) => [
  check('forum_local_services_price_nonneg', sql`${t.basePriceVnd} >= 0`),
  check('forum_local_services_version_pos', sql`${t.localPriceVersion} >= 1`),
]);

export const forumLocalServicePriceHistory = pgTable('forum_local_service_price_history', {
  id: uuid('id').primaryKey(),
  serviceCode: varchar('service_code', { length: 64 }).notNull(),
  localPriceVersion: integer('local_price_version').notNull(),
  basePriceVnd: integer('base_price_vnd').notNull(),
  enabled: boolean('enabled').notNull(),
  options: jsonb('options'),
  actorId: integer('actor_id'),
  source: varchar('source', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('forum_local_service_price_history_ver_uidx').on(t.serviceCode, t.localPriceVersion),
  index('forum_local_service_price_history_created_idx').on(t.serviceCode, t.createdAt),
]);

export const forumOpsServicePolicies = pgTable('forum_ops_service_policies', {
  serviceCode: varchar('service_code', { length: 64 }).primaryKey(),
  banned: boolean('banned').notNull().default(false),
  overridePriceVnd: integer('override_price_vnd'),
  opsVersion: varchar('ops_version', { length: 128 }),
  opsPricingVersionId: varchar('ops_pricing_version_id', { length: 128 }),
  evidence: jsonb('evidence'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
});

export const forumCommercialSettings = pgTable('forum_commercial_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
});
