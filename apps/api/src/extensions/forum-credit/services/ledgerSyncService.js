import { randomBytes } from 'node:crypto';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import db from '../../../db/index.js';
import { opsForumLedgerOutbox } from '../schema.js';
import { LEDGER_SYNC_STATUS } from '../constants.js';

function backoffMs(attemptCount) {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attemptCount - 1));
}

function makeEventId() {
  return `led_evt_${randomBytes(8).toString('hex')}`;
}

/**
 * Durable ledger outbox → OPS reconciliation copy.
 * Source of truth remains local sys_transactions / wallet.
 */
export class LedgerSyncService {
  constructor(fastify, connectionStore, opsClient) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
    this.opsClient = opsClient;
    this._seqLock = Promise.resolve();
  }

  async nextSequence(tx = db) {
    const [row] = await tx
      .select({ max: sql`coalesce(max(${opsForumLedgerOutbox.sequenceNumber}), 0)` })
      .from(opsForumLedgerOutbox);
    return Number(row?.max || 0) + 1;
  }

  /**
   * Enqueue a local ledger transaction for OPS sync.
   * @param {object} transaction — sys_transactions row
   */
  async enqueueFromTransaction(transaction, {
    relatedOrderReference = null,
    correlationId = null,
    tx: outerTx = null,
  } = {}) {
    if (!transaction?.id) return null;

    const run = async (tx) => {
      const existing = await tx.select().from(opsForumLedgerOutbox)
        .where(eq(opsForumLedgerOutbox.transactionId, String(transaction.id)))
        .limit(1);
      if (existing[0]) return existing[0];

      const sequenceNumber = await this.nextSequence(tx);
      const creditDelta = Number(transaction.amount);
      const transactionType = creditDelta >= 0 ? 'grant' : 'deduct';
      const [row] = await tx.insert(opsForumLedgerOutbox).values({
        eventId: makeEventId(),
        transactionId: String(transaction.id),
        localUserId: String(transaction.userId),
        transactionType: transaction.type || transactionType,
        creditDelta,
        sequenceNumber,
        eventTimestamp: transaction.createdAt ? new Date(transaction.createdAt) : new Date(),
        relatedOrderReference,
        correlationId,
        syncStatus: LEDGER_SYNC_STATUS.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date(),
      }).onConflictDoNothing().returning();
      return row || existing[0] || null;
    };

    if (outerTx) return run(outerTx);
    return db.transaction(run);
  }

  async getSyncStats() {
    const rows = await db.select({
      syncStatus: opsForumLedgerOutbox.syncStatus,
      count: sql`count(*)::int`,
    }).from(opsForumLedgerOutbox).groupBy(opsForumLedgerOutbox.syncStatus);
    const stats = { pending: 0, syncing: 0, synced: 0, failed: 0 };
    for (const r of rows) stats[r.syncStatus] = r.count;
    return stats;
  }

  async listOutbox({ limit = 50, status } = {}) {
    const q = db.select().from(opsForumLedgerOutbox).orderBy(asc(opsForumLedgerOutbox.sequenceNumber)).limit(Math.min(200, Math.max(1, limit)));
    if (status) {
      return db.select().from(opsForumLedgerOutbox)
        .where(eq(opsForumLedgerOutbox.syncStatus, status))
        .orderBy(asc(opsForumLedgerOutbox.sequenceNumber))
        .limit(Math.min(200, Math.max(1, limit)));
    }
    return q;
  }

  async processDue({ limit = 50, now = new Date() } = {}) {
    const conn = await this.connectionStore.getRow();
    if (!conn?.credentialCiphertext) {
      return { processed: 0, synced: 0, failed: 0, reason: 'not_enrolled' };
    }

    const due = await db.select().from(opsForumLedgerOutbox)
      .where(and(
        eq(opsForumLedgerOutbox.syncStatus, LEDGER_SYNC_STATUS.PENDING),
        lte(opsForumLedgerOutbox.nextAttemptAt, now),
      ))
      .orderBy(asc(opsForumLedgerOutbox.sequenceNumber))
      .limit(limit);

    // Also retry failed that are due
    const failedDue = await db.select().from(opsForumLedgerOutbox)
      .where(and(
        eq(opsForumLedgerOutbox.syncStatus, LEDGER_SYNC_STATUS.FAILED),
        lte(opsForumLedgerOutbox.nextAttemptAt, now),
      ))
      .orderBy(asc(opsForumLedgerOutbox.sequenceNumber))
      .limit(limit);

    const batch = [...due, ...failedDue].slice(0, limit);
    if (batch.length === 0) {
      return { processed: 0, synced: 0, failed: 0 };
    }

    let credential;
    try {
      credential = await this.connectionStore.getActiveCredentialPlaintext();
    } catch (err) {
      return { processed: 0, synced: 0, failed: 0, reason: err.message };
    }

    const events = batch.map((r) => ({
      eventId: r.eventId,
      transactionId: r.transactionId,
      localUserId: r.localUserId,
      transactionType: r.transactionType,
      creditDelta: r.creditDelta,
      sequenceNumber: r.sequenceNumber,
      eventTimestamp: new Date(r.eventTimestamp).toISOString(),
      relatedOrderReference: r.relatedOrderReference,
      correlationId: r.correlationId,
      forumId: conn.forumId,
    }));

    for (const r of batch) {
      await db.update(opsForumLedgerOutbox)
        .set({ syncStatus: LEDGER_SYNC_STATUS.SYNCING, updatedAt: new Date() })
        .where(eq(opsForumLedgerOutbox.id, r.id));
    }

    try {
      await this.opsClient.ingestLedgerEvents(conn, credential, events);
      const syncedAt = new Date();
      for (const r of batch) {
        await db.update(opsForumLedgerOutbox)
          .set({
            syncStatus: LEDGER_SYNC_STATUS.SYNCED,
            syncedAt,
            lastError: null,
            updatedAt: syncedAt,
          })
          .where(eq(opsForumLedgerOutbox.id, r.id));
      }
      await this.connectionStore.setStatus({ lastSyncAt: syncedAt, lastError: null });
      return { processed: batch.length, synced: batch.length, failed: 0 };
    } catch (err) {
      const attemptAt = new Date();
      for (const r of batch) {
        const attemptCount = (r.attemptCount || 0) + 1;
        await db.update(opsForumLedgerOutbox)
          .set({
            syncStatus: LEDGER_SYNC_STATUS.FAILED,
            attemptCount,
            nextAttemptAt: new Date(attemptAt.getTime() + backoffMs(attemptCount)),
            lastError: err.message,
            updatedAt: attemptAt,
          })
          .where(eq(opsForumLedgerOutbox.id, r.id));
      }
      await this.connectionStore.setStatus({ lastError: `ledger_sync: ${err.message}` });
      return { processed: batch.length, synced: 0, failed: batch.length, error: err.message };
    }
  }

  /** Wrap ledger grant/deduct to auto-enqueue outbox when OPS connected. */
  installLedgerHooks() {
    const ledger = this.fastify.ledger;
    if (!ledger || ledger.__forumCreditHooked) return;

    const self = this;
    const origGrant = ledger.grant.bind(ledger);
    const origDeduct = ledger.deduct.bind(ledger);

    ledger.grant = async function hookedGrant(params) {
      const txRow = await origGrant(params);
      // Skip nested enqueue when caller already enrolled via receiver (tx provided + ops type).
      if (!params.tx) {
        try {
          const conn = await self.connectionStore.getRow();
          if (conn?.credentialCiphertext) {
            await self.enqueueFromTransaction(txRow, {
              relatedOrderReference: params.metadata?.orderReference || null,
              correlationId: params.referenceId ? String(params.referenceId) : null,
            });
          }
        } catch (err) {
          self.fastify.log.warn({ err: err.message }, '[forum-credit] ledger outbox enqueue failed after grant');
        }
      }
      return txRow;
    };

    ledger.deduct = async function hookedDeduct(params) {
      const txRow = await origDeduct(params);
      if (!params.tx) {
        try {
          const conn = await self.connectionStore.getRow();
          if (conn?.credentialCiphertext) {
            await self.enqueueFromTransaction(txRow, {
              relatedOrderReference: params.metadata?.orderReference || null,
              correlationId: params.referenceId ? String(params.referenceId) : null,
            });
          }
        } catch (err) {
          self.fastify.log.warn({ err: err.message }, '[forum-credit] ledger outbox enqueue failed after deduct');
        }
      }
      return txRow;
    };

    ledger.__forumCreditHooked = true;
  }
}
