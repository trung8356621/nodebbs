import { randomBytes } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { vndToCreditAmount } from '../../ledger/utils/money.js';
import {
  DEFAULT_TOPUP_PACKAGES,
  ORDER_STATUS,
  PAYMENT_CODE_PREFIX,
  PAYMENT_CODE_SUFFIX_LEN,
} from '../constants.js';
import { pbnPaymentOrders, pbnTopupPackages } from '../schema.js';
import { resolvePaymentConfig } from '../config.js';

function makeOrderId() {
  return `pbn_pay_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function makePaymentCode(prefix = PAYMENT_CODE_PREFIX) {
  const suffix = randomBytes(Math.ceil(PAYMENT_CODE_SUFFIX_LEN / 2))
    .toString('hex')
    .slice(0, PAYMENT_CODE_SUFFIX_LEN)
    .toUpperCase();
  return `${String(prefix).toUpperCase()}${suffix}`;
}

function makeIdempotency() {
  return `bp_idem_${randomBytes(12).toString('hex')}`;
}

export class OrderService {
  constructor(fastify, providerFactory) {
    this.fastify = fastify;
    this.providerFactory = providerFactory;
  }

  async ensurePackagesSeeded() {
    for (const pack of DEFAULT_TOPUP_PACKAGES) {
      await db.insert(pbnTopupPackages).values({
        code: pack.code,
        label: pack.label,
        amountVnd: pack.amountVnd,
        enabled: pack.enabled,
        displayOrder: pack.displayOrder,
      }).onConflictDoNothing();
    }
  }

  async listPackages({ includeDisabled = false } = {}) {
    await this.ensurePackagesSeeded().catch(() => {});
    const rows = await db.select().from(pbnTopupPackages)
      .orderBy(asc(pbnTopupPackages.displayOrder));
    const rate = await this.#vndPerCredit();
    return rows
      .filter((r) => includeDisabled || r.enabled)
      .map((r) => ({
        code: r.code,
        label: r.label,
        amountVnd: r.amountVnd,
        enabled: r.enabled,
        displayOrder: r.displayOrder,
        estimatedCredits: vndToCreditAmount(r.amountVnd, rate),
        vndPerCredit: rate,
      }));
  }

  async #vndPerCredit() {
    const n = await this.fastify.localPricing?.getVndPerCredit?.();
    const rate = Number(n);
    if (Number.isSafeInteger(rate) && rate >= 1) return rate;
    return 10000;
  }

  async createOrder({
    userId,
    packageCode,
    amountVnd,
    idempotencyKey,
    metadata,
  }) {
    const cfg = await resolvePaymentConfig(this.fastify);
    if (!cfg.enabled && !cfg.fixtureMode) {
      const err = new Error('Bank transfer payment is disabled');
      err.code = 'payment_disabled';
      err.statusCode = 403;
      throw err;
    }
    if (!cfg.publicCheckout && !cfg.fixtureMode) {
      const err = new Error('Bank transfer checkout is not open publicly (Free Mode)');
      err.code = 'checkout_not_public';
      err.statusCode = 403;
      throw err;
    }

    const uid = Number(userId);
    if (!Number.isSafeInteger(uid) || uid <= 0) {
      const err = new Error('userId required');
      err.statusCode = 400;
      throw err;
    }

    const idem = (idempotencyKey || makeIdempotency()).trim();
    const [prior] = await db.select().from(pbnPaymentOrders)
      .where(eq(pbnPaymentOrders.idempotencyKey, idem))
      .limit(1);
    if (prior) return this.toPublic(prior, { reused: true });

    let pack = null;
    let requestedVnd = amountVnd != null ? Math.trunc(Number(amountVnd)) : null;
    if (packageCode) {
      await this.ensurePackagesSeeded().catch(() => {});
      const [row] = await db.select().from(pbnTopupPackages)
        .where(and(eq(pbnTopupPackages.code, packageCode), eq(pbnTopupPackages.enabled, true)))
        .limit(1);
      if (!row) {
        const err = new Error(`Unknown package ${packageCode}`);
        err.code = 'unknown_package';
        err.statusCode = 404;
        throw err;
      }
      pack = row;
      requestedVnd = row.amountVnd;
    }
    if (!Number.isSafeInteger(requestedVnd) || requestedVnd <= 0) {
      const err = new Error('amountVnd must be a positive integer');
      err.statusCode = 400;
      throw err;
    }

    const rate = await this.#vndPerCredit();
    const creditsPreview = vndToCreditAmount(requestedVnd, rate);
    const provider = this.providerFactory(cfg.provider);
    const orderId = makeOrderId();
    const paymentCode = makePaymentCode(cfg.sepay.paymentCodePrefix || PAYMENT_CODE_PREFIX);
    const expiresAt = new Date(Date.now() + cfg.orderTtlMinutes * 60_000);

    const paymentReq = await provider.createPaymentRequest({
      orderId,
      paymentCode,
      amountVnd: requestedVnd,
      config: cfg.sepay,
    });

    const [row] = await db.insert(pbnPaymentOrders).values({
      orderId,
      paymentCode,
      userId: uid,
      packageCode: pack?.code || packageCode || null,
      amountVndRequested: requestedVnd,
      creditsToGrant: creditsPreview,
      vndPerCreditApplied: null, // snapshotted only on confirm
      provider: provider.name,
      receiveAccountNumber: paymentReq.accountNumber,
      receiveBankCode: paymentReq.bankCode,
      status: ORDER_STATUS.AWAITING_FUNDS,
      idempotencyKey: idem,
      qrPayloadJson: JSON.stringify(paymentReq),
      expiresAt,
      sandbox: Boolean(cfg.sandbox || cfg.fixtureMode),
      metadataJson: metadata ? JSON.stringify({
        ...metadata,
        creditsPreview,
        previewVndPerCredit: rate,
      }) : JSON.stringify({ creditsPreview, previewVndPerCredit: rate }),
    }).returning();

    return this.toPublic(row, { paymentRequest: paymentReq });
  }

  async getOrder(orderId, { userId } = {}) {
    const [row] = await db.select().from(pbnPaymentOrders)
      .where(eq(pbnPaymentOrders.orderId, String(orderId)))
      .limit(1);
    if (!row) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    if (userId != null && Number(row.userId) !== Number(userId)) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    return this.toPublic(row);
  }

  async findByPaymentCode(paymentCode) {
    const [row] = await db.select().from(pbnPaymentOrders)
      .where(eq(pbnPaymentOrders.paymentCode, String(paymentCode).toUpperCase()))
      .limit(1);
    return row || null;
  }

  async findByOrderId(orderId) {
    const [row] = await db.select().from(pbnPaymentOrders)
      .where(eq(pbnPaymentOrders.orderId, String(orderId)))
      .limit(1);
    return row || null;
  }

  toPublic(row, extra = {}) {
    let qr = null;
    try {
      qr = row.qrPayloadJson ? JSON.parse(row.qrPayloadJson) : null;
    } catch {
      qr = null;
    }
    return {
      orderId: row.orderId,
      paymentCode: row.paymentCode,
      userId: row.userId,
      packageCode: row.packageCode,
      amountVndRequested: row.amountVndRequested,
      amountVndReceived: row.amountVndReceived,
      creditsToGrant: row.creditsToGrant,
      creditsGranted: row.creditsGranted,
      vndPerCreditApplied: row.vndPerCreditApplied,
      provider: row.provider,
      providerTxnRef: row.providerTxnRef,
      bankTxnRef: row.bankTxnRef,
      status: row.status,
      matchResult: row.matchResult,
      ledgerTransactionId: row.ledgerTransactionId,
      confirmedAt: row.confirmedAt,
      grantedAt: row.grantedAt,
      expiresAt: row.expiresAt,
      sandbox: row.sandbox,
      qr,
      receiveAccountNumber: row.receiveAccountNumber,
      receiveBankCode: row.receiveBankCode,
      ...extra,
    };
  }
}
