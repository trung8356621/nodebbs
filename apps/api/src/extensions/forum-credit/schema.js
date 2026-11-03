import {
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  bigint,
} from 'drizzle-orm/pg-core';
import { $defaults } from '../../db/columns.js';

/**
 * Single OPS connection for this Forum installation (1 process = 1 forum).
 * Machine credential ciphertext lives here — never returned to the browser.
 */
export const opsForumConnections = pgTable('ops_forum_connections', {
  ...$defaults,
  opsBaseUrl: varchar('ops_base_url', { length: 500 }).notNull(),
  installationId: varchar('installation_id', { length: 64 }).notNull(),
  forumId: varchar('forum_id', { length: 64 }).notNull(),
  apiContractVersion: varchar('api_contract_version', { length: 32 }).notNull().default('forum-credit/1'),
  credentialVersion: integer('credential_version').notNull().default(1),
  /** AES-256-GCM payload: iv.tag.ciphertext (base64url), never log/plaintext. */
  credentialCiphertext: text('credential_ciphertext').notNull(),
  credentialKekVersion: varchar('credential_kek_version', { length: 32 }).notNull().default('v1'),
  /** SHA-256 hex of plaintext credential for constant-time auth compare. */
  credentialFingerprint: varchar('credential_fingerprint', { length: 64 }).notNull(),
  connectionStatus: varchar('connection_status', { length: 32 }).notNull().default('disconnected'),
  connectionUrl: varchar('connection_url', { length: 500 }),
  pendingRotationId: varchar('pending_rotation_id', { length: 64 }),
  pendingCredentialCiphertext: text('pending_credential_ciphertext'),
  pendingCredentialFingerprint: varchar('pending_credential_fingerprint', { length: 64 }),
  pendingCredentialVersion: integer('pending_credential_version'),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  enabled: boolean('enabled').notNull().default(true),
}, (table) => [
  uniqueIndex('ops_forum_connections_installation_uidx').on(table.installationId),
  uniqueIndex('ops_forum_connections_forum_uidx').on(table.forumId),
]);

/** Idempotent store of OPS → PBN credit delivery events. */
export const opsForumCreditDeliveries = pgTable('ops_forum_credit_deliveries', {
  ...$defaults,
  eventId: varchar('event_id', { length: 64 }).notNull(),
  orderId: varchar('order_id', { length: 64 }),
  orderReference: varchar('order_reference', { length: 128 }),
  forumId: varchar('forum_id', { length: 64 }).notNull(),
  installationId: varchar('installation_id', { length: 64 }).notNull(),
  localUserId: varchar('local_user_id', { length: 64 }).notNull(),
  orderKind: varchar('order_kind', { length: 32 }),
  amountVnd: integer('amount_vnd').notNull().default(0),
  creditsGranted: integer('credits_granted').notNull().default(0),
  isFreeLaunch: boolean('is_free_launch').notNull().default(false),
  transactionId: integer('transaction_id'),
  payloadJson: text('payload_json').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ops_forum_credit_deliveries_event_uidx').on(table.eventId),
  index('ops_forum_credit_deliveries_order_idx').on(table.orderId),
  index('ops_forum_credit_deliveries_user_idx').on(table.localUserId),
]);

/** Local tracking of Credit Orders submitted to OPS. */
export const opsForumCreditOrders = pgTable('ops_forum_credit_orders', {
  ...$defaults,
  installationId: varchar('installation_id', { length: 64 }).notNull(),
  forumId: varchar('forum_id', { length: 64 }).notNull(),
  opsOrderId: varchar('ops_order_id', { length: 64 }),
  localUserId: varchar('local_user_id', { length: 64 }).notNull(),
  orderReference: varchar('order_reference', { length: 128 }).notNull(),
  amountVnd: integer('amount_vnd').notNull().default(0),
  creditsToGrant: integer('credits_to_grant').notNull().default(0),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  orderKind: varchar('order_kind', { length: 32 }).notNull().default('free_grant'),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  lastError: text('last_error'),
  metadataJson: text('metadata_json'),
}, (table) => [
  uniqueIndex('ops_forum_credit_orders_ref_uidx').on(table.installationId, table.orderReference),
  uniqueIndex('ops_forum_credit_orders_idem_uidx').on(table.installationId, table.idempotencyKey),
  index('ops_forum_credit_orders_user_idx').on(table.localUserId),
]);

/**
 * Outbox for PBN → OPS ledger reconciliation copies.
 * Durable until OPS ACK; retries on reconnect.
 */
export const opsForumLedgerOutbox = pgTable('ops_forum_ledger_outbox', {
  ...$defaults,
  eventId: varchar('event_id', { length: 64 }).notNull(),
  transactionId: varchar('transaction_id', { length: 64 }).notNull(),
  localUserId: varchar('local_user_id', { length: 64 }).notNull(),
  transactionType: varchar('transaction_type', { length: 64 }).notNull(),
  creditDelta: bigint('credit_delta', { mode: 'number' }).notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
  relatedOrderReference: varchar('related_order_reference', { length: 128 }),
  correlationId: varchar('correlation_id', { length: 64 }),
  syncStatus: varchar('sync_status', { length: 32 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ops_forum_ledger_outbox_event_uidx').on(table.eventId),
  uniqueIndex('ops_forum_ledger_outbox_tx_uidx').on(table.transactionId),
  uniqueIndex('ops_forum_ledger_outbox_seq_uidx').on(table.sequenceNumber),
  index('ops_forum_ledger_outbox_status_idx').on(table.syncStatus, table.nextAttemptAt),
]);
