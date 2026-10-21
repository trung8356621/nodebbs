import { sql } from 'drizzle-orm';
import { pgTable, serial, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const policyRules = pgTable('policy_rules', {
  id: text('id').primaryKey(), scope: text('scope').notNull(), category: text('category').notNull(),
  type: text('type').notNull(), value: text('value').notNull(), action: text('action').notNull(),
  priority: integer('priority').notNull().default(0), enabled: boolean('enabled').notNull().default(true),
  reason: text('reason').notNull(), createdAt: createdAt(),
}, t => [uniqueIndex('policy_rules_identity_idx').on(t.scope, t.type, t.value)]);
export const policyVersions = pgTable('policy_versions', {
  scope: text('scope').primaryKey(), version: integer('version').notNull(), checksum: text('checksum').notNull(),
  source: text('source').notNull(), appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});
export const policyDecisions = pgTable('policy_decisions', {
  id: serial('id').primaryKey(), forumId: text('forum_id').notNull(), userId: integer('user_id'),
  contentType: text('content_type').notNull(), contentId: integer('content_id'), action: text('action').notNull(),
  ruleIds: jsonb('rule_ids').notNull(), reason: text('reason').notNull(), contentHash: text('content_hash').notNull(),
  createdAt: createdAt(),
}, t => [index('policy_decisions_created_idx').on(t.createdAt)]);
export const policySyncs = pgTable('policy_syncs', {
  id: serial('id').primaryKey(), success: boolean('success').notNull(), version: integer('version'),
  reason: text('reason').notNull(), createdAt: createdAt(),
});
export const policyScans = pgTable('policy_scans', {
  id: serial('id').primaryKey(), status: text('status').notNull().default('pending'),
  dryRun: boolean('dry_run').notNull().default(true), target: integer('target').notNull().default(0),
  cursor: integer('cursor').notNull().default(0), scanned: integer('scanned').notNull().default(0),
  affected: integer('affected').notNull().default(0), error: text('error'), createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, () => [uniqueIndex('policy_scans_one_active_idx').on(sql`(true)`).where(sql`status IN ('pending','running')`)]);
