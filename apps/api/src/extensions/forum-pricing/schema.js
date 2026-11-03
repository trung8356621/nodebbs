import {
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { $defaults } from '../../db/columns.js';

/**
 * Immutable verified forum-pricing/1 snapshots from OPS-SERVER.
 * Historical SEO file snapshots (ops_price_snapshots) remain untouched.
 */
export const opsForumPricingSnapshots = pgTable('ops_forum_pricing_snapshots', {
  ...$defaults,
  version: integer('version').notNull(),
  pricingVersionId: varchar('pricing_version_id', { length: 64 }).notNull(),
  productKey: varchar('product_key', { length: 32 }).notNull().default('pbn'),
  schemaVersion: varchar('schema_version', { length: 32 }).notNull().default('forum-pricing/1'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  vndPerCredit: integer('vnd_per_credit').notNull(),
  keyId: varchar('key_id', { length: 64 }).notNull(),
  publicKey: text('public_key').notNull(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  snapshot: jsonb('snapshot').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ops_forum_pricing_snapshots_version_uidx').on(table.version),
  uniqueIndex('ops_forum_pricing_snapshots_version_id_uidx').on(table.pricingVersionId),
  index('ops_forum_pricing_snapshots_effective_idx').on(table.effectiveAt),
]);

export const opsForumPricingSyncs = pgTable('ops_forum_pricing_syncs', {
  ...$defaults,
  success: boolean('success').notNull(),
  afterVersion: integer('after_version'),
  currentVersion: integer('current_version'),
  importedCount: integer('imported_count').notNull().default(0),
  reason: text('reason').notNull(),
}, (table) => [
  index('ops_forum_pricing_syncs_created_idx').on(table.createdAt),
]);
