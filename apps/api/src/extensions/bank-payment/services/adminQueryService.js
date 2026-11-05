import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import db from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { resolveConfiguredPublicOrigin } from '../../forum-credit/services/callbackUrl.js';
import { resolvePaymentConfig } from '../config.js';
import { pbnPaymentEvents, pbnPaymentOrders, pbnTopupPackages } from '../schema.js';
import { vndToCreditAmount } from '../../ledger/utils/money.js';

function maskAccount(accountNumber) {
  const s = String(accountNumber || '').replace(/\s+/g, '');
  if (!s) return null;
  if (s.length <= 4) return `••••${s}`;
  return `${'•'.repeat(Math.min(6, s.length - 4))}${s.slice(-4)}`;
}

function connectionStatus(cfg) {
  if (!cfg.enabled) return 'payment_off';
  if (!cfg.sepay.accountNumber || !cfg.sepay.bankCode) return 'bank_unconfigured';
  if (!cfg.sepay.webhookSecret && !cfg.sepay.apiKey) return 'webhook_unconfigured';
  if (cfg.sandbox) return 'sandbox_ready';
  if (!cfg.mayGrantCredits) return 'grants_blocked';
  return 'ready';
}

/**
 * Admin read models for Payment UI — no reconciliation/ledger mutations.
 */
export class AdminQueryService {
  constructor(fastify, orderService) {
    this.fastify = fastify;
    this.orderService = orderService;
  }

  async getAdminConfig() {
    const cfg = await resolvePaymentConfig(this.fastify);
    const originInfo = await resolveConfiguredPublicOrigin(this.fastify.settings).catch(() => null);
    const origin = originInfo?.configuredOrigin || null;
    const webhookPath = '/payments/webhooks/sepay';
    const webhookUrl = origin ? `${origin}${webhookPath}` : null;

    const [lastEvent] = await db.select({
      id: pbnPaymentEvents.id,
      createdAt: pbnPaymentEvents.createdAt,
      processedAt: pbnPaymentEvents.processedAt,
      status: pbnPaymentEvents.status,
      matchResult: pbnPaymentEvents.matchResult,
      provider: pbnPaymentEvents.provider,
      orderId: pbnPaymentEvents.orderId,
    }).from(pbnPaymentEvents)
      .orderBy(desc(pbnPaymentEvents.createdAt))
      .limit(1)
      .catch(() => [null]);

    const bankConfigured = Boolean(cfg.sepay.accountNumber && cfg.sepay.bankCode);
    const secretsOk = Boolean(cfg.sepay.webhookSecret || cfg.sepay.apiKey);

    return {
      provider: cfg.provider,
      sandbox: cfg.sandbox,
      fixtureMode: cfg.fixtureMode,
      enabled: cfg.enabled,
      publicCheckout: cfg.publicCheckout,
      mayGrantCredits: cfg.mayGrantCredits,
      orderTtlMinutes: cfg.orderTtlMinutes,
      connectionStatus: connectionStatus(cfg),
      paymentOpen: Boolean(cfg.enabled && cfg.publicCheckout),
      bankConfigured,
      webhookConfigured: secretsOk,
      sepayConfigured: bankConfigured && secretsOk,
      webhookUrl,
      webhookPath,
      webhookUrlReady: Boolean(webhookUrl && originInfo?.usableAsCallback),
      publicOriginSource: originInfo?.source || null,
      receiveBank: {
        configured: bankConfigured,
        bankCode: cfg.sepay.bankCode || null,
        accountName: cfg.sepay.accountName || null,
        accountNumberMasked: maskAccount(cfg.sepay.accountNumber),
      },
      secrets: {
        webhookSecret: Boolean(cfg.sepay.webhookSecret),
        apiToken: Boolean(cfg.sepay.apiToken),
        accountNumber: Boolean(cfg.sepay.accountNumber),
        bankCode: Boolean(cfg.sepay.bankCode),
      },
      lastWebhook: lastEvent ? {
        at: lastEvent.processedAt || lastEvent.createdAt,
        status: lastEvent.status,
        matchResult: lastEvent.matchResult,
        provider: lastEvent.provider,
        orderId: lastEvent.orderId,
      } : null,
      // UI must not offer production activation.
      productionActivation: {
        supportedInUi: false,
        reason: 'not_supported',
        message: 'Production activation requires env + PO approval — not available in Admin UI.',
      },
    };
  }

  async getOverview() {
    const config = await this.getAdminConfig();
    let orderCount = 0;
    try {
      const [row] = await db.select({ n: count() }).from(pbnPaymentOrders);
      orderCount = Number(row?.n || 0);
    } catch {
      orderCount = 0;
    }
    return {
      ...config,
      orderCount,
    };
  }

  async listPackagesAdmin() {
    await this.orderService.ensurePackagesSeeded().catch(() => {});
    const rate = await this.#vndPerCredit();
    const rows = await db.select().from(pbnTopupPackages)
      .orderBy(asc(pbnTopupPackages.displayOrder), asc(pbnTopupPackages.id));
    return {
      vndPerCredit: rate,
      packages: rows.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.label,
        amountVnd: r.amountVnd,
        enabled: r.enabled,
        displayOrder: r.displayOrder,
        estimatedCredits: vndToCreditAmount(r.amountVnd, rate),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }

  async upsertPackage({ code, label, amountVnd, enabled, displayOrder }) {
    const trimmedCode = String(code || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!trimmedCode || trimmedCode.length < 3) {
      const err = new Error('package code required');
      err.statusCode = 400;
      err.code = 'invalid_package';
      throw err;
    }
    const vnd = Math.trunc(Number(amountVnd));
    if (!Number.isSafeInteger(vnd) || vnd <= 0) {
      const err = new Error('amountVnd must be a positive integer');
      err.statusCode = 400;
      err.code = 'invalid_vnd';
      throw err;
    }
    const name = String(label || trimmedCode).trim().slice(0, 120) || trimmedCode;
    const order = Number.isFinite(Number(displayOrder)) ? Math.trunc(Number(displayOrder)) : 100;
    const on = enabled !== false;

    const [existing] = await db.select().from(pbnTopupPackages)
      .where(eq(pbnTopupPackages.code, trimmedCode))
      .limit(1);

    if (existing) {
      const [row] = await db.update(pbnTopupPackages)
        .set({
          label: name,
          amountVnd: vnd,
          enabled: on,
          displayOrder: order,
          updatedAt: new Date(),
        })
        .where(eq(pbnTopupPackages.id, existing.id))
        .returning();
      return this.#packPublic(row);
    }

    const [row] = await db.insert(pbnTopupPackages).values({
      code: trimmedCode,
      label: name,
      amountVnd: vnd,
      enabled: on,
      displayOrder: order,
    }).returning();
    return this.#packPublic(row);
  }

  async patchPackage(code, patch) {
    const [existing] = await db.select().from(pbnTopupPackages)
      .where(eq(pbnTopupPackages.code, String(code)))
      .limit(1);
    if (!existing) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      err.code = 'unknown_package';
      throw err;
    }
    const next = {
      updatedAt: new Date(),
    };
    if (patch.label != null) next.label = String(patch.label).trim().slice(0, 120);
    if (patch.amountVnd != null) {
      const vnd = Math.trunc(Number(patch.amountVnd));
      if (!Number.isSafeInteger(vnd) || vnd <= 0) {
        const err = new Error('amountVnd must be a positive integer');
        err.statusCode = 400;
        err.code = 'invalid_vnd';
        throw err;
      }
      next.amountVnd = vnd;
    }
    if (patch.enabled != null) next.enabled = Boolean(patch.enabled);
    if (patch.displayOrder != null) next.displayOrder = Math.trunc(Number(patch.displayOrder)) || 0;

    const [row] = await db.update(pbnTopupPackages)
      .set(next)
      .where(eq(pbnTopupPackages.id, existing.id))
      .returning();
    return this.#packPublic(row);
  }

  async listOrders({ status, from, to, page = 1, limit = 20 } = {}) {
    const pageN = Math.max(1, Number(page) || 1);
    const limitN = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageN - 1) * limitN;

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(pbnPaymentOrders.status, String(status)));
    }
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) conditions.push(gte(pbnPaymentOrders.createdAt, d));
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        // Inclusive end-of-day if date-only
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
        conditions.push(lte(pbnPaymentOrders.createdAt, d));
      }
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [totalRow] = await db.select({ n: count() }).from(pbnPaymentOrders).where(where);
    const rows = await db.select({
      order: pbnPaymentOrders,
      username: users.username,
      userName: users.name,
    })
      .from(pbnPaymentOrders)
      .leftJoin(users, eq(pbnPaymentOrders.userId, users.id))
      .where(where)
      .orderBy(desc(pbnPaymentOrders.createdAt))
      .limit(limitN)
      .offset(offset);

    return {
      items: rows.map(({ order, username, userName }) => ({
        ...this.orderService.toPublic(order),
        username: username || null,
        userDisplayName: userName || username || String(order.userId),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      pagination: {
        page: pageN,
        limit: limitN,
        total: Number(totalRow?.n || 0),
        totalPages: Math.max(1, Math.ceil(Number(totalRow?.n || 0) / limitN)),
      },
    };
  }

  async getOrderDetail(orderId) {
    const order = await this.orderService.findByOrderId(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
    }).from(users).where(eq(users.id, order.userId)).limit(1);

    const events = await db.select().from(pbnPaymentEvents)
      .where(eq(pbnPaymentEvents.orderId, order.orderId))
      .orderBy(desc(pbnPaymentEvents.createdAt))
      .limit(50);

    return {
      order: {
        ...this.orderService.toPublic(order),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        lastError: order.lastError,
        username: user?.username || null,
        userDisplayName: user?.name || user?.username || String(order.userId),
      },
      events: events.map((e) => ({
        id: e.id,
        provider: e.provider,
        providerEventId: e.providerEventId,
        providerTxnRef: e.providerTxnRef,
        bankTxnRef: e.bankTxnRef,
        status: e.status,
        matchResult: e.matchResult,
        amountVnd: e.amountVnd,
        accountNumberMasked: maskAccount(e.accountNumber),
        signatureValid: e.signatureValid,
        processedAt: e.processedAt,
        createdAt: e.createdAt,
        errorMessage: e.errorMessage,
        // raw payload available for admin debug without secrets
        hasRawPayload: Boolean(e.rawPayloadJson),
      })),
      ledgerReference: order.ledgerTransactionId
        ? {
          transactionId: order.ledgerTransactionId,
          referenceType: 'bank_payment_order',
          referenceId: order.orderId,
        }
        : null,
    };
  }

  async #vndPerCredit() {
    const n = await this.fastify.localPricing?.getVndPerCredit?.();
    const rate = Number(n);
    if (Number.isSafeInteger(rate) && rate >= 1) return rate;
    return 10000;
  }

  #packPublic(row) {
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      amountVnd: row.amountVnd,
      enabled: row.enabled,
      displayOrder: row.displayOrder,
    };
  }
}
