import { eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { DEFAULT_CURRENCY_CODE } from '../../ledger/constants.js';
import {
  EVENT_STATUS,
  MATCH_RESULT,
  ORDER_STATUS,
  REF_TYPE_BANK_ORDER,
  TX_TYPE_BANK_TOPUP,
} from '../constants.js';
import { resolvePaymentConfig } from '../config.js';
import { pbnPaymentEvents, pbnPaymentOrders } from '../schema.js';
import {
  matchInboundTransfer,
  resolveLateOrDuplicate,
  shouldGrantToLedger,
} from './reconcileEngine.js';

/**
 * Inbound provider webhook → verify → match → optional ledger.grant (once).
 * Never grants from forged/replay/underpay/unknown-order paths.
 */
export class WebhookService {
  constructor(fastify, orderService, providerFactory) {
    this.fastify = fastify;
    this.orderService = orderService;
    this.providerFactory = providerFactory;
  }

  async handleWebhook({ providerName, rawBody, headers, parsedBody }) {
    const cfg = await resolvePaymentConfig(this.fastify);
    const provider = this.providerFactory(providerName || cfg.provider);

    const verify = await provider.verifyWebhook({
      rawBody,
      headers,
      parsedBody,
      config: {
        ...cfg.sepay,
        webhookSecret: cfg.sepay.webhookSecret,
        apiKey: cfg.sepay.apiKey,
        allowInsecureFixture: cfg.fixtureMode && !cfg.sepay.webhookSecret,
      },
    });

    if (!verify.ok) {
      await this.#recordEvent({
        provider: provider.name,
        providerEventId: `reject_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: EVENT_STATUS.REJECTED,
        matchResult: verify.reason === 'replay' ? MATCH_RESULT.REPLAY : MATCH_RESULT.FORGED,
        signatureValid: false,
        rawBody,
        headers,
        errorMessage: verify.detail || verify.reason,
      }).catch(() => {});
      const err = new Error(verify.reason === 'replay' ? 'Webhook replay rejected' : 'Webhook authentication failed');
      err.code = verify.reason || 'forged';
      err.statusCode = 401;
      throw err;
    }

    const tx = verify.transaction;
    return this.applyNormalizedTransfer({
      providerName: provider.name,
      tx,
      rawBody,
      headers,
      signatureValid: true,
      cfg,
      provider,
    });
  }

  /**
   * Shared path for webhook + reconciliation API lookups.
   */
  async applyNormalizedTransfer({
    providerName,
    tx,
    rawBody,
    headers,
    signatureValid = true,
    cfg,
    provider,
  }) {
    const paymentConfig = cfg || await resolvePaymentConfig(this.fastify);
    const adapter = provider || this.providerFactory(providerName || paymentConfig.provider);

    // Idempotent short-circuit on provider event id.
    const [existingEvent] = await db.select().from(pbnPaymentEvents)
      .where(eq(pbnPaymentEvents.providerEventId, String(tx.providerEventId)))
      .limit(1);
    // Unique is (provider, providerEventId) — check both.
    if (existingEvent && existingEvent.provider === adapter.name) {
      return {
        success: true,
        duplicate: true,
        matchResult: existingEvent.matchResult,
        orderId: existingEvent.orderId,
        status: existingEvent.status,
      };
    }

    let order = null;
    if (tx.paymentCode) {
      order = await this.orderService.findByPaymentCode(tx.paymentCode);
    }

    const rate = order?.vndPerCreditApplied
      || await this.fastify.localPricing?.getVndPerCredit?.().catch(() => 10000)
      || 10000;

    let decision = matchInboundTransfer({
      order,
      tx,
      expect: {
        accountNumber: order?.receiveAccountNumber || paymentConfig.sepay.accountNumber,
      },
      vndPerCredit: Number(rate),
    });
    decision = resolveLateOrDuplicate({ order, tx, priorDecision: decision });

    const result = await db.transaction(async (dbTx) => {
      // Re-check event uniqueness inside txn.
      const [dup] = await dbTx.select().from(pbnPaymentEvents)
        .where(eq(pbnPaymentEvents.providerEventId, String(tx.providerEventId)))
        .limit(1);
      if (dup && dup.provider === adapter.name) {
        return {
          success: true,
          duplicate: true,
          matchResult: dup.matchResult,
          orderId: dup.orderId,
        };
      }

      let ledgerTransactionId = null;
      let granted = false;
      let finalOrderStatus = decision.orderStatus;
      let creditsGranted = null;
      const now = new Date();

      const mayGrant = shouldGrantToLedger(decision, paymentConfig);

      if (order && decision.grant) {
        // Lock order row.
        const [locked] = await dbTx.select().from(pbnPaymentOrders)
          .where(eq(pbnPaymentOrders.orderId, order.orderId))
          .limit(1)
          .for('update');

        if (locked.ledgerTransactionId || locked.status === ORDER_STATUS.GRANTED) {
          decision = {
            ...decision,
            grant: false,
            duplicate: true,
            matchResult: MATCH_RESULT.ALREADY_COMPLETE,
          };
          finalOrderStatus = locked.status;
          ledgerTransactionId = locked.ledgerTransactionId;
        } else if (mayGrant) {
          if (!this.fastify.ledger) {
            throw Object.assign(new Error('Ledger unavailable'), { statusCode: 503 });
          }
          const grantTx = await this.fastify.ledger.grant({
            userId: locked.userId,
            amount: decision.creditsToGrant,
            currencyCode: DEFAULT_CURRENCY_CODE,
            type: TX_TYPE_BANK_TOPUP,
            referenceType: REF_TYPE_BANK_ORDER,
            referenceId: locked.orderId,
            description: `Bank top-up ${locked.paymentCode}`,
            metadata: {
              amountVnd: decision.amountVndRequested,
              amountVndReceived: decision.amountVndReceived,
              excessVnd: decision.excessVnd,
              creditVnd: decision.vndPerCreditApplied,
              valueVnd: decision.amountVndRequested,
              provider: adapter.name,
              providerTxnRef: decision.providerTxnRef,
              bankTxnRef: decision.bankTxnRef,
              paymentCode: locked.paymentCode,
              sandbox: locked.sandbox,
            },
            tx: dbTx,
          });
          ledgerTransactionId = grantTx.id;
          creditsGranted = decision.creditsToGrant;
          granted = true;
          finalOrderStatus = ORDER_STATUS.GRANTED;
        } else {
          // Sandbox / flag OFF: record payment confirmation without wallet grant.
          finalOrderStatus = decision.matchResult === MATCH_RESULT.OVERPAY
            ? ORDER_STATUS.OVERPAID
            : ORDER_STATUS.PAID;
        }

        if (!decision.duplicate) {
          await dbTx.update(pbnPaymentOrders)
            .set({
              status: finalOrderStatus,
              matchResult: decision.matchResult,
              amountVndReceived: decision.amountVndReceived,
              creditsToGrant: decision.creditsToGrant,
              creditsGranted: creditsGranted,
              vndPerCreditApplied: decision.vndPerCreditApplied,
              providerTxnRef: decision.providerTxnRef || null,
              bankTxnRef: decision.bankTxnRef || null,
              ledgerTransactionId,
              confirmedAt: now,
              grantedAt: granted ? now : null,
              updatedAt: now,
            })
            .where(eq(pbnPaymentOrders.id, locked.id));
        }
      } else if (order && !decision.duplicate) {
        await dbTx.update(pbnPaymentOrders)
          .set({
            status: decision.orderStatus || order.status,
            matchResult: decision.matchResult,
            amountVndReceived: decision.amountVndReceived ?? order.amountVndReceived,
            lastError: decision.grant ? null : decision.matchResult,
            updatedAt: now,
          })
          .where(eq(pbnPaymentOrders.orderId, order.orderId));
      }

      await dbTx.insert(pbnPaymentEvents).values({
        provider: adapter.name,
        providerEventId: String(tx.providerEventId),
        providerTxnRef: tx.providerTxnRef || null,
        bankTxnRef: tx.bankTxnRef || null,
        orderId: order?.orderId || null,
        paymentCode: tx.paymentCode || order?.paymentCode || null,
        transferType: tx.transferType || null,
        amountVnd: tx.amountVnd ?? null,
        accountNumber: tx.accountNumber || null,
        status: decision.duplicate
          ? EVENT_STATUS.DUPLICATE
          : decision.grant
            ? EVENT_STATUS.MATCHED
            : decision.matchResult === MATCH_RESULT.UNKNOWN_ORDER
              ? EVENT_STATUS.IGNORED
              : EVENT_STATUS.RECEIVED,
        matchResult: decision.matchResult,
        signatureValid,
        rawPayloadJson: typeof rawBody === 'string'
          ? rawBody
          : JSON.stringify(tx.raw || tx),
        headersJson: headers ? JSON.stringify(headers) : null,
        processedAt: now,
        errorMessage: decision.grant || decision.duplicate ? null : decision.matchResult,
      });

      return {
        success: true,
        duplicate: Boolean(decision.duplicate),
        matchResult: decision.matchResult,
        orderId: order?.orderId || null,
        orderStatus: finalOrderStatus,
        creditsGranted,
        ledgerTransactionId,
        granted,
        sandboxRecordOnly: decision.grant && !mayGrant,
      };
    });

    return result;
  }

  async reconcileOrder(orderId) {
    const cfg = await resolvePaymentConfig(this.fastify);
    const order = await this.orderService.findByOrderId(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }
    const provider = this.providerFactory(order.provider || cfg.provider);
    const status = await provider.reconcilePayment(
      { paymentCode: order.paymentCode, orderId: order.orderId, providerTxnRef: order.providerTxnRef },
      cfg.sepay,
    );
    if (status.status === 'offline') {
      await db.update(pbnPaymentOrders)
        .set({ status: ORDER_STATUS.PROVIDER_OFFLINE, lastError: status.error || 'provider_offline', updatedAt: new Date() })
        .where(eq(pbnPaymentOrders.orderId, order.orderId));
      return { success: false, matchResult: MATCH_RESULT.PROVIDER_OFFLINE, error: status.error };
    }
    if (status.status !== 'paid' || !status.transaction) {
      return { success: true, matchResult: 'pending', orderStatus: order.status };
    }
    return this.applyNormalizedTransfer({
      providerName: provider.name,
      tx: status.transaction,
      rawBody: JSON.stringify(status.transaction.raw || status.transaction),
      headers: { 'x-pbn-source': 'reconcile' },
      signatureValid: true,
      cfg,
      provider,
    });
  }

  async #recordEvent(fields) {
    await db.insert(pbnPaymentEvents).values({
      provider: fields.provider,
      providerEventId: fields.providerEventId,
      status: fields.status,
      matchResult: fields.matchResult,
      signatureValid: fields.signatureValid,
      rawPayloadJson: typeof fields.rawBody === 'string'
        ? fields.rawBody
        : JSON.stringify(fields.rawBody || {}),
      headersJson: fields.headers ? JSON.stringify(fields.headers) : null,
      errorMessage: fields.errorMessage || null,
      processedAt: new Date(),
    });
  }
}
