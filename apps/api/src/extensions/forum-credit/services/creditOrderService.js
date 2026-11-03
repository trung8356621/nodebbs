import { randomBytes } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import db from '../../../db/index.js';
import { opsForumCreditOrders, opsForumCreditDeliveries } from '../schema.js';
import { ORDER_STATUS } from '../constants.js';

function makeRef() {
  return `pbn_ord_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function makeIdempotency() {
  return `idem_${randomBytes(12).toString('hex')}`;
}

export class CreditOrderService {
  constructor(fastify, connectionStore, opsClient) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
    this.opsClient = opsClient;
  }

  async #requirePricingPackage(packageCode) {
    if (!this.fastify.forumPricing?.getPackage) {
      const err = new Error('No authorized current credit package price is available');
      err.code = 'price_unavailable';
      err.statusCode = 409;
      throw err;
    }
    return this.fastify.forumPricing.getPackage(packageCode);
  }

  /**
   * Create order using OPS forum-pricing/1 packageCode (+ pricingVersion).
   * OPS is monetary authority; amountVnd/creditsToGrant are sent only as exact echoes.
   */
  async createPackageOrder({
    localUserId,
    packageId,
    packageCode,
    pricingVersion,
    quoteId = null,
    orderReference,
    idempotencyKey,
    metadata,
  }) {
    const code = packageCode || packageId;
    if (!code || typeof code !== 'string') {
      const err = new Error('packageCode is required');
      err.statusCode = 400;
      throw err;
    }
    const pack = await this.#requirePricingPackage(code);
    const orderKind = pack.amountVnd === 0 ? 'free_grant' : 'paid_topup';
    return this.#submitOrder({
      localUserId,
      orderReference,
      idempotencyKey,
      amountVnd: pack.amountVnd,
      creditsToGrant: pack.creditsGranted,
      orderKind,
      opsBody: {
        packageCode: pack.code || code,
        pricingVersion: pricingVersion ?? pack.pricingVersion ?? pack.snapshotVersion,
        quoteId: quoteId || null,
      },
      metadata: {
        ...(metadata || {}),
        packageCode: pack.code || code,
        priceVersion: pack.priceVersion ?? pack.pricingVersion,
        snapshotVersion: pack.snapshotVersion,
        sourceId: pack.sourceId,
        unitPrice: pack.unitPrice,
        quantity: 1,
        totalCredits: pack.totalCredits,
        pricingContract: 'forum-pricing/1',
      },
    });
  }

  /**
   * Free launch via OPS freeLaunch policy (forum-pricing/1).
   * Does not invent credits — OPS catalog freeLaunch.creditsToGrant is authoritative.
   */
  async createFreeGrantOrder({
    localUserId,
    creditsToGrant,
    packageId,
    packageCode,
    pricingVersion,
    orderReference,
    idempotencyKey,
    metadata,
  }) {
    if (packageId || packageCode) {
      return this.createPackageOrder({
        localUserId,
        packageId,
        packageCode,
        pricingVersion,
        orderReference,
        idempotencyKey,
        metadata,
      });
    }

    const catalog = await this.fastify.forumPricing?.getCatalogView?.();
    if (!catalog?.freeLaunch?.enabled) {
      const err = new Error('free_launch_disabled');
      err.code = 'free_launch_disabled';
      err.statusCode = 400;
      throw err;
    }
    const policyCredits = catalog.freeLaunch.creditsToGrant;
    if (creditsToGrant != null && Number(creditsToGrant) !== policyCredits) {
      const err = new Error('price_tamper');
      err.code = 'price_tamper';
      err.statusCode = 400;
      throw err;
    }

    return this.#submitOrder({
      localUserId,
      orderReference,
      idempotencyKey,
      amountVnd: 0,
      creditsToGrant: policyCredits,
      orderKind: 'free_grant',
      opsBody: {
        freeLaunch: true,
        pricingVersion: pricingVersion ?? catalog.snapshotVersion,
      },
      metadata: {
        ...(metadata || {}),
        freeLaunch: true,
        pricingVersion: pricingVersion ?? catalog.snapshotVersion,
        pricingContract: 'forum-pricing/1',
      },
    });
  }

  async #submitOrder({
    localUserId,
    orderReference,
    idempotencyKey,
    amountVnd,
    creditsToGrant,
    orderKind,
    opsBody = {},
    metadata,
  }) {
    const row = await this.connectionStore.getRow();
    if (!row?.credentialCiphertext) {
      const err = new Error('Not enrolled with OPS');
      err.code = 'not_enrolled';
      err.statusCode = 400;
      throw err;
    }

    const userId = String(localUserId || '').trim();
    if (!userId) {
      const err = new Error('localUserId is required');
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isInteger(creditsToGrant) || creditsToGrant < 0) {
      const err = new Error('creditsToGrant must be a non-negative integer');
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isInteger(amountVnd) || amountVnd < 0) {
      const err = new Error('amountVnd must be a non-negative integer');
      err.statusCode = 400;
      throw err;
    }

    const ref = (orderReference || makeRef()).trim();
    const idem = (idempotencyKey || makeIdempotency()).trim();

    const [prior] = await db.select().from(opsForumCreditOrders)
      .where(and(
        eq(opsForumCreditOrders.installationId, row.installationId),
        eq(opsForumCreditOrders.idempotencyKey, idem),
      ))
      .limit(1);
    if (prior) return prior;

    const [local] = await db.insert(opsForumCreditOrders).values({
      installationId: row.installationId,
      forumId: row.forumId,
      localUserId: userId,
      orderReference: ref,
      amountVnd,
      creditsToGrant,
      idempotencyKey: idem,
      orderKind,
      status: ORDER_STATUS.PENDING,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    }).returning();

    try {
      const credential = await this.connectionStore.getActiveCredentialPlaintext();
      // OPS owns monetary fields. Echo amount/credits only as exact match for tamper checks.
      const { data } = await this.opsClient.createCreditOrder(row, credential, {
        localUserId: userId,
        orderReference: ref,
        idempotencyKey: idem,
        amountVnd,
        creditsToGrant,
        ...opsBody,
      });

      const [updated] = await db.update(opsForumCreditOrders)
        .set({
          opsOrderId: data.id,
          status: ORDER_STATUS.SUBMITTED,
          orderKind: data.orderKind || orderKind,
          updatedAt: new Date(),
          lastError: null,
        })
        .where(eq(opsForumCreditOrders.id, local.id))
        .returning();
      return updated;
    } catch (err) {
      await db.update(opsForumCreditOrders)
        .set({
          status: ORDER_STATUS.FAILED,
          lastError: err.message,
          updatedAt: new Date(),
        })
        .where(eq(opsForumCreditOrders.id, local.id));
      throw err;
    }
  }

  async listOrders({ limit = 50 } = {}) {
    return db.select().from(opsForumCreditOrders)
      .orderBy(desc(opsForumCreditOrders.id))
      .limit(Math.min(100, Math.max(1, limit)));
  }

  async listDeliveries({ limit = 50 } = {}) {
    return db.select().from(opsForumCreditDeliveries)
      .orderBy(desc(opsForumCreditDeliveries.id))
      .limit(Math.min(100, Math.max(1, limit)));
  }
}
