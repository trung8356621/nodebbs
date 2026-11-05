import {
  pgTable, uuid, integer, varchar, text, jsonb, timestamp, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const forumNetworkSettings = pgTable('forum_network_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
});

export const forumNetworkChildren = pgTable('forum_network_children', {
  childForumId: varchar('child_forum_id', { length: 64 }).primaryKey(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  databaseName: varchar('database_name', { length: 128 }).notNull(),
  apiOrigin: varchar('api_origin', { length: 500 }),
  webOrigin: varchar('web_origin', { length: 500 }),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  templateId: varchar('template_id', { length: 64 }),
  freeModeExpiresAt: timestamp('free_mode_expires_at', { withTimezone: true }),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('forum_network_children_status_chk', sql`${t.status} IN ('active', 'disabled', 'provisioning', 'failed')`),
  index('forum_network_children_status_idx').on(t.status, t.createdAt),
]);

export const forumNetworkTemplates = pgTable('forum_network_templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
});

export const forumNetworkPolicyVersions = pgTable('forum_network_policy_versions', {
  version: varchar('version', { length: 128 }).primaryKey(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer('created_by'),
}, (t) => [
  uniqueIndex('forum_network_policy_versions_checksum_uidx').on(t.checksum),
]);

export const forumNetworkPolicyApplications = pgTable('forum_network_policy_applications', {
  id: uuid('id').primaryKey(),
  policyVersion: varchar('policy_version', { length: 128 }).notNull(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  source: varchar('source', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  appliedKeys: jsonb('applied_keys').notNull().default([]),
  skippedKeys: jsonb('skipped_keys').notNull().default([]),
  errorMessage: text('error_message'),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  actorId: integer('actor_id'),
}, (t) => [
  check('forum_network_policy_applications_status_chk', sql`${t.status} IN ('applied', 'skipped_duplicate', 'failed', 'partial')`),
  index('forum_network_policy_applications_applied_idx').on(t.appliedAt),
]);

export const forumTopicReferenceSnapshots = pgTable('forum_topic_reference_snapshots', {
  id: uuid('id').primaryKey(),
  sourceForumId: varchar('source_forum_id', { length: 64 }).notNull(),
  sourceTopicKey: varchar('source_topic_key', { length: 128 }),
  titleNormalized: text('title_normalized').notNull(),
  titleHash: varchar('title_hash', { length: 64 }).notNull(),
  categoryHint: varchar('category_hint', { length: 128 }),
  packageVersion: varchar('package_version', { length: 128 }),
  meta: jsonb('meta').notNull().default({}),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('forum_topic_reference_snapshots_hash_idx').on(t.titleHash),
  index('forum_topic_reference_snapshots_source_idx').on(t.sourceForumId, t.capturedAt),
  uniqueIndex('forum_topic_reference_snapshots_dedupe_uidx').on(t.sourceForumId, t.titleHash),
]);
