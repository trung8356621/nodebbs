import {
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  numeric,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { $defaults } from '../../db/columns.js';
import { users } from '../../db/schema.js';

/**
 * Local Credit top-up packages (Forum-owned; independent of OPS catalog).
 * Credits are computed at confirmation from current vndPerCredit — never revalued later.
 */
export const pbnTopupPackages = pgTable('pbn_topup_packages', {
  ...$defaults,
  code: varchar('code', { length: 64 }).notNull(),
  label: varchar('label', { length: 120 }).notNull(),
  amountVnd: integer('amount_vnd').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  metadataJson: text('metadata_json'),
}, (t) => [
  uniqueIndex('pbn_topup_packages_code_uidx').on(t.code),
  check('pbn_topup_packages_vnd_pos', sql`${t.amountVnd} > 0`),
  index('pbn_topup_packages_order_idx').on(t.displayOrder),
]);

/**
 * Bank-transfer Credit top-up orders.
 * Snapshots requested VND, received VND, credits granted, and rate at confirm time.
 */
export const pbnPaymentOrders = pgTable('pbn_payment_orders', {
  ...$defaults,
  orderId: varchar('order_id', { length: 64 }).notNull(),
  paymentCode: varchar('payment_code', { length: 32 }).notNull(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  packageCode: varchar('package_code', { length: 64 }),
  amountVndRequested: integer('amount_vnd_requested').notNull(),
  amountVndReceived: integer('amount_vnd_received'),
  creditsToGrant: numeric('credits_to_grant', { precision: 30, scale: 10, mode: 'string' }),
  creditsGranted: numeric('credits_granted', { precision: 30, scale: 10, mode: 'string' }),
  /** VND-per-Credit rate snapshotted when payment confirmed / Credit granted. */
  vndPerCreditApplied: integer('vnd_per_credit_applied'),
  provider: varchar('provider', { length: 32 }).notNull(),
  providerTxnRef: varchar('provider_txn_ref', { length: 128 }),
  bankTxnRef: varchar('bank_txn_ref', { length: 128 }),
  receiveAccountNumber: varchar('receive_account_number', { length: 64 }),
  receiveBankCode: varchar('receive_bank_code', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  ledgerTransactionId: integer('ledger_transaction_id'),
  qrPayloadJson: text('qr_payload_json'),
  matchResult: varchar('match_result', { length: 64 }),
  lastError: text('last_error'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadataJson: text('metadata_json'),
  sandbox: boolean('sandbox').notNull().default(true),
}, (t) => [
  uniqueIndex('pbn_payment_orders_order_uidx').on(t.orderId),
  uniqueIndex('pbn_payment_orders_code_uidx').on(t.paymentCode),
  uniqueIndex('pbn_payment_orders_idem_uidx').on(t.idempotencyKey),
  uniqueIndex('pbn_payment_orders_provider_txn_uidx').on(t.provider, t.providerTxnRef),
  index('pbn_payment_orders_user_idx').on(t.userId),
  index('pbn_payment_orders_status_idx').on(t.status),
  check('pbn_payment_orders_vnd_req_pos', sql`${t.amountVndRequested} > 0`),
]);

/**
 * Durable webhook / reconciliation events for audit + idempotency.
 * Unique on (provider, providerEventId) prevents duplicate delivery grants.
 */
export const pbnPaymentEvents = pgTable('pbn_payment_events', {
  ...$defaults,
  provider: varchar('provider', { length: 32 }).notNull(),
  providerEventId: varchar('provider_event_id', { length: 128 }).notNull(),
  providerTxnRef: varchar('provider_txn_ref', { length: 128 }),
  bankTxnRef: varchar('bank_txn_ref', { length: 128 }),
  orderId: varchar('order_id', { length: 64 }),
  paymentCode: varchar('payment_code', { length: 32 }),
  transferType: varchar('transfer_type', { length: 16 }),
  amountVnd: integer('amount_vnd'),
  accountNumber: varchar('account_number', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('received'),
  matchResult: varchar('match_result', { length: 64 }),
  signatureValid: boolean('signature_valid'),
  rawPayloadJson: text('raw_payload_json').notNull(),
  headersJson: text('headers_json'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, (t) => [
  uniqueIndex('pbn_payment_events_provider_event_uidx').on(t.provider, t.providerEventId),
  index('pbn_payment_events_order_idx').on(t.orderId),
  index('pbn_payment_events_code_idx').on(t.paymentCode),
  index('pbn_payment_events_status_idx').on(t.status),
]);
