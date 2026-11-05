/**
 * Independent bank-payment foundation tests (node:test).
 * Run: node --test apps/api/src/extensions/bank-payment/tests/bank-payment.test.js
 *
 * Uses SePay-shaped fixtures only — no real bank traffic, no production wallet writes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MATCH_RESULT,
  ORDER_STATUS,
  PROVIDER_FIXTURE,
  PROVIDER_SEPAY,
} from '../constants.js';
import { readEnvConfig } from '../config.js';
import {
  matchInboundTransfer,
  resolveLateOrDuplicate,
  shouldGrantToLedger,
} from '../services/reconcileEngine.js';
import {
  createFixtureAdapter,
  createSePayAdapter,
  signFixtureWebhook,
  verifySePayWebhook,
  normalizeSePayPayload,
} from '../providers/index.js';
import { vndToCreditAmount } from '../../ledger/utils/money.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../../../../');
const fixturesDir = path.join(root, 'contracts/bank-payment/v1');

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'));
}

function baseOrder(overrides = {}) {
  return {
    orderId: 'pbn_pay_test_1',
    paymentCode: 'PBNABCDEF12',
    amountVndRequested: 100000,
    status: ORDER_STATUS.AWAITING_FUNDS,
    receiveAccountNumber: '0123456789',
    ledgerTransactionId: null,
    providerTxnRef: null,
    ...overrides,
  };
}

describe('bank-payment feature flag defaults', () => {
  it('defaults enabled/public OFF', () => {
    const prev = { ...process.env };
    delete process.env.BANK_PAYMENT_ENABLED;
    delete process.env.BANK_PAYMENT_PUBLIC;
    delete process.env.BANK_PAYMENT_SANDBOX_GRANT;
    const cfg = readEnvConfig();
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.publicCheckout, false);
    assert.equal(cfg.sandboxGrantToWallet, false);
    Object.assign(process.env, prev);
  });
});

describe('SePay adapter HMAC + normalize', () => {
  const secret = 'test_sepay_webhook_secret_32chars!!';

  it('accepts valid HMAC webhook and normalizes transaction', () => {
    const payload = loadFixture('webhook-exact.example.json');
    const signed = signFixtureWebhook(payload, secret);
    const result = verifySePayWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      config: { webhookSecret: secret },
    });
    assert.equal(result.ok, true);
    assert.equal(result.transaction.paymentCode, 'PBNABCDEF12');
    assert.equal(result.transaction.amountVnd, 100000);
    assert.equal(result.transaction.transferType, 'in');
    assert.equal(result.transaction.provider, PROVIDER_SEPAY);
  });

  it('rejects forged signature', () => {
    const payload = loadFixture('webhook-exact.example.json');
    const signed = signFixtureWebhook(payload, secret);
    const result = verifySePayWebhook({
      rawBody: signed.rawBody,
      headers: { ...signed.headers, 'x-sepay-signature': 'sha256=deadbeef' },
      config: { webhookSecret: secret },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'forged');
  });

  it('rejects replay outside timestamp window', () => {
    const payload = loadFixture('webhook-exact.example.json');
    const oldTs = Math.floor(Date.now() / 1000) - 3600;
    const signed = signFixtureWebhook(payload, secret, oldTs);
    const result = verifySePayWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      config: { webhookSecret: secret },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'replay');
  });

  it('createPaymentRequest builds VietQR without calling bank', async () => {
    const adapter = createSePayAdapter();
    const req = await adapter.createPaymentRequest({
      orderId: 'o1',
      paymentCode: 'PBNABCDEF12',
      amountVnd: 100000,
      config: {
        accountNumber: '0123456789',
        bankCode: 'Vietcombank',
        accountName: 'PBN TEST',
      },
    });
    assert.equal(req.provider, PROVIDER_SEPAY);
    assert.match(req.qrImageUrl, /qr\.sepay\.vn/);
    assert.match(req.qrImageUrl, /PBNABCDEF12/);
    assert.equal(req.amountVnd, 100000);
  });
});

describe('reconcile engine scenarios', () => {
  const rate = 10000;
  const expect = { accountNumber: '0123456789' };

  it('exact payment → grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.OK);
    assert.equal(d.grant, true);
    assert.equal(d.creditsToGrant, vndToCreditAmount(100000, rate));
    assert.equal(d.vndPerCreditApplied, rate);
  });

  it('underpay → no grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-underpay.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.UNDERPAY);
    assert.equal(d.grant, false);
    assert.equal(d.orderStatus, ORDER_STATUS.UNDERPAID);
  });

  it('overpay → grant ordered credits only + record excess', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-overpay.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.OVERPAY);
    assert.equal(d.grant, true);
    assert.equal(d.excessVnd, 50000);
    assert.equal(d.creditsToGrant, vndToCreditAmount(100000, rate));
  });

  it('wrong code → no grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-wrong-code.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.WRONG_CODE);
    assert.equal(d.grant, false);
  });

  it('wrong account → no grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-wrong-account.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.WRONG_ACCOUNT);
    assert.equal(d.grant, false);
  });

  it('unknown order → unmatched', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const d = matchInboundTransfer({ order: null, tx, expect, vndPerCredit: rate });
    assert.equal(d.matchResult, MATCH_RESULT.UNKNOWN_ORDER);
    assert.equal(d.grant, false);
  });

  it('duplicate event id → no second grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const d = matchInboundTransfer({
      order: baseOrder(),
      tx,
      expect,
      vndPerCredit: rate,
      seenEventIds: new Set([String(tx.providerEventId)]),
    });
    assert.equal(d.duplicate, true);
    assert.equal(d.grant, false);
  });

  it('retry / already complete order → no second grant', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const order = baseOrder({
      status: ORDER_STATUS.GRANTED,
      ledgerTransactionId: 42,
      providerTxnRef: 'FT260001EXACT',
    });
    const first = matchInboundTransfer({ order, tx, expect, vndPerCredit: rate });
    const late = resolveLateOrDuplicate({ order, tx, priorDecision: first });
    assert.equal(late.duplicate, true);
    assert.equal(late.grant, false);
    assert.equal(late.matchResult, MATCH_RESULT.ALREADY_COMPLETE);
  });

  it('late webhook after grant → duplicate ack semantics', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const order = baseOrder({ status: ORDER_STATUS.GRANTED, ledgerTransactionId: 7 });
    const d = resolveLateOrDuplicate({
      order,
      tx,
      priorDecision: { grant: true, matchResult: MATCH_RESULT.OK },
    });
    assert.equal(d.late, true);
    assert.equal(d.grant, false);
  });

  it('rate change after payment does not revalue decision credits', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const atPay = matchInboundTransfer({
      order: baseOrder(),
      tx,
      expect,
      vndPerCredit: 10000,
    });
    const laterRate = matchInboundTransfer({
      order: baseOrder(),
      tx,
      expect,
      vndPerCredit: 5000,
    });
    assert.equal(atPay.creditsToGrant, '10');
    assert.equal(laterRate.creditsToGrant, '20');
    // Historical order must keep snapshotted rate — engine uses the rate passed in
    // (caller supplies order.vndPerCreditApplied when already confirmed).
    const historical = matchInboundTransfer({
      order: baseOrder({ status: ORDER_STATUS.GRANTED, ledgerTransactionId: 1 }),
      tx,
      expect,
      vndPerCredit: 5000,
    });
    assert.equal(historical.grant, false);
    assert.equal(historical.duplicate, true);
  });

  it('sandbox config blocks ledger grant even when match OK', () => {
    const tx = normalizeSePayPayload(loadFixture('webhook-exact.example.json'));
    const d = matchInboundTransfer({ order: baseOrder(), tx, expect, vndPerCredit: rate });
    assert.equal(d.grant, true);
    assert.equal(shouldGrantToLedger(d, { mayGrantCredits: false }), false);
    assert.equal(shouldGrantToLedger(d, { mayGrantCredits: true }), true);
  });
});

describe('fixture provider offline + reconcile', () => {
  it('reports provider offline', async () => {
    const adapter = createFixtureAdapter();
    adapter.setOffline(true);
    const status = await adapter.getPaymentStatus({ paymentCode: 'PBNABCDEF12' });
    assert.equal(status.status, 'offline');
  });

  it('reconcile finds injected transaction', async () => {
    const adapter = createFixtureAdapter();
    adapter.injectTransaction(loadFixture('webhook-exact.example.json'));
    const status = await adapter.reconcilePayment({ paymentCode: 'PBNABCDEF12' });
    assert.equal(status.status, 'paid');
    assert.equal(status.transaction.paymentCode, 'PBNABCDEF12');
  });

  it('fixture adapter name is fixture', () => {
    assert.equal(createFixtureAdapter().name, PROVIDER_FIXTURE);
  });
});
