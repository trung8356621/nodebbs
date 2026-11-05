/**
 * Pure payment matching / Credit grant decision engine.
 * No DB, no SePay SDK, no Ledger — unit-testable against webhook fixtures.
 */

import { MATCH_RESULT, ORDER_STATUS } from '../constants.js';
import { vndToCreditAmount } from '../../ledger/utils/money.js';

const COMPLETE_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.GRANTED,
  ORDER_STATUS.OVERPAID,
]);

/**
 * @param {object} params
 * @param {object|null} params.order local pending/paid order or null
 * @param {object} params.tx NormalizedTransaction
 * @param {object} params.expect { accountNumber, bankCode? }
 * @param {number} params.vndPerCredit current rate (snapshotted on confirm)
 * @param {Set<string>} [params.seenEventIds]
 * @param {Set<string>} [params.seenTxnRefs]
 */
export function matchInboundTransfer({
  order,
  tx,
  expect,
  vndPerCredit,
  seenEventIds = new Set(),
  seenTxnRefs = new Set(),
}) {
  if (!tx || tx.transferType === 'out') {
    return decide(MATCH_RESULT.OUTBOUND, { grant: false });
  }

  if (tx.providerEventId && seenEventIds.has(String(tx.providerEventId))) {
    return decide(MATCH_RESULT.ALREADY_COMPLETE, {
      grant: false,
      duplicate: true,
      orderStatus: order?.status,
    });
  }
  if (tx.providerTxnRef && seenTxnRefs.has(String(tx.providerTxnRef))) {
    return decide(MATCH_RESULT.ALREADY_COMPLETE, {
      grant: false,
      duplicate: true,
    });
  }

  const expectedAccount = String(expect?.accountNumber || '').replace(/\s+/g, '');
  const gotAccount = String(tx.accountNumber || '').replace(/\s+/g, '');
  if (expectedAccount && gotAccount && expectedAccount !== gotAccount) {
    return decide(MATCH_RESULT.WRONG_ACCOUNT, {
      grant: false,
      orderStatus: ORDER_STATUS.FAILED,
    });
  }

  if (!order) {
    return decide(MATCH_RESULT.UNKNOWN_ORDER, {
      grant: false,
      orderStatus: ORDER_STATUS.UNMATCHED,
    });
  }

  if (COMPLETE_STATUSES.has(order.status) || order.ledgerTransactionId) {
    return decide(MATCH_RESULT.ALREADY_COMPLETE, {
      grant: false,
      duplicate: true,
      orderStatus: order.status,
      orderId: order.orderId,
    });
  }

  const orderCode = String(order.paymentCode || '').toUpperCase();
  const txCode = tx.paymentCode ? String(tx.paymentCode).toUpperCase() : '';
  const content = String(tx.content || '').toUpperCase();
  const codeOk = (txCode && txCode === orderCode)
    || (!txCode && orderCode && content.includes(orderCode));
  if (!codeOk) {
    return decide(MATCH_RESULT.WRONG_CODE, {
      grant: false,
      orderStatus: ORDER_STATUS.FAILED,
      orderId: order.orderId,
    });
  }

  const requested = Math.trunc(Number(order.amountVndRequested));
  const received = Math.trunc(Number(tx.amountVnd));
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return decide(MATCH_RESULT.UNKNOWN_ORDER, { grant: false });
  }
  if (!Number.isSafeInteger(received) || received < 0) {
    return decide(MATCH_RESULT.UNDERPAY, {
      grant: false,
      orderStatus: ORDER_STATUS.UNDERPAID,
      orderId: order.orderId,
      amountVndReceived: received,
    });
  }

  if (received < requested) {
    return decide(MATCH_RESULT.UNDERPAY, {
      grant: false,
      orderStatus: ORDER_STATUS.UNDERPAID,
      orderId: order.orderId,
      amountVndReceived: received,
      amountVndRequested: requested,
    });
  }

  const rate = Number(vndPerCredit);
  // Grant Credit for the *ordered* VND amount only (excess is recorded, not auto-refunded).
  const creditsToGrant = vndToCreditAmount(requested, rate);
  const excessVnd = received > requested ? received - requested : 0;

  if (excessVnd > 0) {
    return decide(MATCH_RESULT.OVERPAY, {
      grant: true,
      orderStatus: ORDER_STATUS.OVERPAID,
      orderId: order.orderId,
      amountVndReceived: received,
      amountVndRequested: requested,
      excessVnd,
      creditsToGrant,
      vndPerCreditApplied: rate,
      providerTxnRef: tx.providerTxnRef,
      bankTxnRef: tx.bankTxnRef,
    });
  }

  return decide(MATCH_RESULT.OK, {
    grant: true,
    orderStatus: ORDER_STATUS.PAID,
    orderId: order.orderId,
    amountVndReceived: received,
    amountVndRequested: requested,
    excessVnd: 0,
    creditsToGrant,
    vndPerCreditApplied: rate,
    providerTxnRef: tx.providerTxnRef,
    bankTxnRef: tx.bankTxnRef,
  });
}

function decide(matchResult, extra = {}) {
  return {
    matchResult,
    grant: Boolean(extra.grant),
    duplicate: Boolean(extra.duplicate),
    orderStatus: extra.orderStatus || null,
    orderId: extra.orderId || null,
    amountVndReceived: extra.amountVndReceived ?? null,
    amountVndRequested: extra.amountVndRequested ?? null,
    excessVnd: extra.excessVnd ?? 0,
    creditsToGrant: extra.creditsToGrant ?? null,
    vndPerCreditApplied: extra.vndPerCreditApplied ?? null,
    providerTxnRef: extra.providerTxnRef || null,
    bankTxnRef: extra.bankTxnRef || null,
  };
}

/**
 * Apply late webhook / retry semantics: if order already granted with same txn ref → duplicate OK.
 * If already granted with different txn → ignore (no second grant).
 */
export function resolveLateOrDuplicate({ order, tx, priorDecision }) {
  if (!order) return priorDecision;
  if (COMPLETE_STATUSES.has(order.status) || order.status === ORDER_STATUS.GRANTED) {
    const sameTxn = order.providerTxnRef
      && tx?.providerTxnRef
      && String(order.providerTxnRef) === String(tx.providerTxnRef);
    return {
      ...priorDecision,
      grant: false,
      duplicate: true,
      matchResult: MATCH_RESULT.ALREADY_COMPLETE,
      late: true,
      sameTxn: Boolean(sameTxn),
      orderStatus: order.status,
    };
  }
  return priorDecision;
}

/** Whether Credit should be written to the production ledger for this decision + config. */
export function shouldGrantToLedger(decision, paymentConfig) {
  if (!decision?.grant) return false;
  if (!paymentConfig?.mayGrantCredits) return false;
  return true;
}
