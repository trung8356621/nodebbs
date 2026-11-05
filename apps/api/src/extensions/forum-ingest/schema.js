import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { $defaults } from '../../db/columns.js';
import { users } from '../../db/schema.js';

/**
 * Machine integrations for external Markdown topic ingest (SEO-OPS).
 * Secrets are stored as SHA-256 hashes only; plaintext shown once at create.
 */
export const forumIngestIntegrations = pgTable('forum_ingest_integrations', {
  ...$defaults,
  /** Human label, e.g. "SEO-OPS production". */
  name: varchar('name', { length: 120 }).notNull(),
  /** Public key id prefix used in Bearer token (not secret). */
  keyId: varchar('key_id', { length: 32 }).notNull(),
  /** SHA-256 hex of full bearer secret. */
  secretHash: text('secret_hash').notNull(),
  /** Forum user that authors ingested topics (must have topic.create, not admin). */
  authorUserId: integer('author_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  /** Optional multi-forum scope; null = single-forum deploy. */
  forumId: varchar('forum_id', { length: 64 }),
  /** active | revoked */
  status: varchar('status', { length: 20 }).notNull().default('active'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('forum_ingest_integrations_key_id_uidx').on(t.keyId),
  index('forum_ingest_integrations_author_idx').on(t.authorUserId),
  index('forum_ingest_integrations_status_idx').on(t.status),
]);

/**
 * Idempotency ledger: one row per (integration, externalRef).
 * payload_hash mismatch → 409; match → return existing topic.
 */
export const forumIngestTopicRefs = pgTable('forum_ingest_topic_refs', {
  ...$defaults,
  integrationId: integer('integration_id')
    .notNull()
    .references(() => forumIngestIntegrations.id, { onDelete: 'cascade' }),
  externalRef: varchar('external_ref', { length: 191 }).notNull(),
  payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
  topicId: integer('topic_id').notNull(),
  approvalStatus: varchar('approval_status', { length: 20 }).notNull(),
  requiresApproval: integer('requires_approval').notNull().default(0),
  canonicalUrl: text('canonical_url').notNull(),
}, (t) => [
  uniqueIndex('forum_ingest_topic_refs_integration_ref_uidx').on(
    t.integrationId,
    t.externalRef,
  ),
  index('forum_ingest_topic_refs_topic_idx').on(t.topicId),
]);
