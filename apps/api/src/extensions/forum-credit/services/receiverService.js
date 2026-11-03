import { eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { DEFAULT_CURRENCY_CODE } from '../../ledger/constants.js';
import { opsForumCreditDeliveries, opsForumCreditOrders } from '../schema.js';
import {
  CREDIT_EVENT_TYPE,
  FORUM_CREDIT_CONTRACT,
  REF_TYPE_OPS_EVENT,
  TX_TYPE_OPS_CREDIT_GRANT,
} from '../constants.js';

/**
 * Inbound OPS → PBN receiver (ping + credit-granted).
 * ACK `{ ack: true }` only after durable commit.
 */
export class ReceiverService {
  constructor(fastify, connectionStore, ledgerSync) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
    this.ledgerSync = ledgerSync;
  }

  async ping(request) {
    const bearer = request.authBearer;
    const forumId = request.headers['x-ops-forum-id'];
    const installationId = request.headers['x-ops-installation-id'];
    const row = await this.connectionStore.authenticateInbound({
      bearer,
      forumId,
      installationId,
    });

    const body = request.body || {};
    if (body.forumId && body.forumId !== row.forumId) {
      const err = new Error('Forum ID mismatch in body');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }
    if (body.installationId && body.installationId !== row.installationId) {
      const err = new Error('Installation ID mismatch in body');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }

    await this.connectionStore.setStatus({
      connectionStatus: 'connected',
      lastVerifiedAt: new Date(),
      lastError: null,
    });

    return {
      ok: true,
      forumId: row.forumId,
      installationId: row.installationId,
      apiContractVersion: row.apiContractVersion || FORUM_CREDIT_CONTRACT,
    };
  }

  async applyCreditGranted(request) {
    const bearer = request.authBearer;
    const headerForumId = request.headers['x-ops-forum-id'];
    const headerInstallationId = request.headers['x-ops-installation-id'];
    const headerEventId = request.headers['x-ops-event-id'];

    const row = await this.connectionStore.authenticateInbound({
      bearer,
      forumId: headerForumId,
      installationId: headerInstallationId,
    });

    const payload = request.body || {};
    const eventId = String(payload.eventId || headerEventId || '').trim();
    if (!eventId) {
      const err = new Error('eventId is required');
      err.code = 'invalid_request';
      err.statusCode = 400;
      throw err;
    }
    if (payload.eventType && payload.eventType !== CREDIT_EVENT_TYPE) {
      const err = new Error(`Unsupported eventType '${payload.eventType}'`);
      err.code = 'invalid_request';
      err.statusCode = 422;
      throw err;
    }
    if (payload.forumId && payload.forumId !== row.forumId) {
      const err = new Error('cross-forum credit delivery denied');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }
    if (payload.installationId && payload.installationId !== row.installationId) {
      const err = new Error('cross-installation credit delivery denied');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }

    // Idempotent short-circuit (duplicate → ACK, no second grant).
    const [existing] = await db.select().from(opsForumCreditDeliveries)
      .where(eq(opsForumCreditDeliveries.eventId, eventId))
      .limit(1);
    if (existing) {
      return { ack: true, duplicate: true, eventId, transactionId: existing.transactionId };
    }

    const localUserId = String(payload.localUserId || '').trim();
    const creditsToGrant = payload.creditsToGrant;
    if (!localUserId) {
      const err = new Error('localUserId is required');
      err.code = 'invalid_request';
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isInteger(creditsToGrant) || creditsToGrant < 0) {
      const err = new Error('creditsToGrant must be a non-negative integer');
      err.code = 'invalid_credits';
      err.statusCode = 400;
      throw err;
    }

    const userId = Number(localUserId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      const err = new Error('localUserId must be a positive integer user id');
      err.code = 'invalid_request';
      err.statusCode = 400;
      throw err;
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      const err = new Error(`Local user ${userId} not found`);
      err.code = 'user_not_found';
      err.statusCode = 422;
      throw err;
    }

    const amountVnd = Number.isInteger(payload.amountVnd) ? payload.amountVnd : 0;
    const isFreeLaunch = Boolean(payload.isFreeLaunch) || amountVnd === 0;
    const orderReference = payload.orderReference ? String(payload.orderReference) : null;
    const orderId = payload.orderId ? String(payload.orderId) : null;

    const result = await db.transaction(async (tx) => {
      // Re-check inside transaction against race.
      const [dup] = await tx.select().from(opsForumCreditDeliveries)
        .where(eq(opsForumCreditDeliveries.eventId, eventId))
        .limit(1);
      if (dup) {
        return { ack: true, duplicate: true, eventId, transactionId: dup.transactionId };
      }

      let transaction = null;
      if (creditsToGrant > 0) {
        if (!this.fastify.ledger) {
          throw Object.assign(new Error('Ledger extension unavailable'), { statusCode: 503 });
        }
        transaction = await this.fastify.ledger.grant({
          userId,
          amount: creditsToGrant,
          currencyCode: DEFAULT_CURRENCY_CODE,
          type: TX_TYPE_OPS_CREDIT_GRANT,
          referenceType: REF_TYPE_OPS_EVENT,
          referenceId: eventId,
          description: isFreeLaunch
            ? `OPS free grant ${orderReference || eventId}`
            : `OPS credit grant ${orderReference || eventId}`,
          metadata: {
            orderId,
            orderReference,
            orderKind: payload.orderKind,
            amountVnd,
            isFreeLaunch,
            forumId: row.forumId,
            installationId: row.installationId,
          },
          tx,
        });
      }

      const [delivery] = await tx.insert(opsForumCreditDeliveries).values({
        eventId,
        orderId,
        orderReference,
        forumId: row.forumId,
        installationId: row.installationId,
        localUserId: String(userId),
        orderKind: payload.orderKind || (isFreeLaunch ? 'free_grant' : 'paid_topup'),
        amountVnd,
        creditsGranted: creditsToGrant,
        isFreeLaunch,
        transactionId: transaction?.id ?? null,
        payloadJson: JSON.stringify(payload),
        appliedAt: new Date(),
      }).returning();

      if (orderReference) {
        await tx.update(opsForumCreditOrders)
          .set({ status: 'delivered', updatedAt: new Date() })
          .where(eq(opsForumCreditOrders.orderReference, orderReference));
      }

      if (transaction && this.ledgerSync) {
        await this.ledgerSync.enqueueFromTransaction(transaction, {
          relatedOrderReference: orderReference,
          correlationId: eventId,
          tx,
        });
      }

      return {
        ack: true,
        duplicate: false,
        eventId,
        transactionId: delivery.transactionId,
        creditsGranted: creditsToGrant,
      };
    });

    return result;
  }
}
