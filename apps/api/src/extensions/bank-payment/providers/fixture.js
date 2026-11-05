import { createHmac } from 'node:crypto';
import { PROVIDER_FIXTURE, WEBHOOK_REPLAY_WINDOW_SEC } from '../constants.js';
import { buildVietQrUrl, normalizeSePayPayload, verifySePayWebhook } from './sepay.js';

/**
 * Sandbox / fixture adapter — SePay-shaped payloads, no real bank calls.
 * Used for local tests and Free Mode dry-runs.
 */
export function createFixtureAdapter(store = { transactions: new Map() }) {
  return {
    name: PROVIDER_FIXTURE,
    store,

    async createPaymentRequest(input) {
      const cfg = input.config || {};
      const accountNumber = cfg.accountNumber || '0000000000';
      const bankCode = cfg.bankCode || 'Vietcombank';
      const paymentCode = String(input.paymentCode).toUpperCase();
      const amountVnd = Math.trunc(Number(input.amountVnd));
      const qrImageUrl = buildVietQrUrl({
        accountNumber,
        bankCode,
        amountVnd,
        paymentCode,
        accountName: cfg.accountName || 'PBN SANDBOX',
      });
      return {
        provider: PROVIDER_FIXTURE,
        paymentCode,
        amountVnd,
        accountNumber,
        bankCode,
        accountName: cfg.accountName || 'PBN SANDBOX',
        transferContent: paymentCode,
        qrImageUrl,
        raw: { source: 'fixture' },
      };
    },

    async verifyWebhook(input) {
      const cfg = {
        ...(input.config || {}),
        allowInsecureFixture: Boolean(input.config?.allowInsecureFixture),
      };
      // Reuse SePay HMAC rules when secret present; otherwise allow signed fixture helper.
      if (cfg.webhookSecret) {
        return verifySePayWebhook({ ...input, config: cfg });
      }
      if (!cfg.allowInsecureFixture) {
        return { ok: false, reason: 'missing_secret' };
      }
      let parsed = input.parsedBody;
      if (!parsed) {
        try {
          const body = typeof input.rawBody === 'string'
            ? input.rawBody
            : Buffer.isBuffer(input.rawBody)
              ? input.rawBody.toString('utf8')
              : '{}';
          parsed = JSON.parse(body);
        } catch {
          return { ok: false, reason: 'forged', detail: 'invalid_json' };
        }
      }
      const transaction = normalizeSePayPayload(parsed);
      transaction.provider = PROVIDER_FIXTURE;
      if (!transaction.providerEventId) {
        return { ok: false, reason: 'forged', detail: 'missing_event_id' };
      }
      return { ok: true, transaction };
    },

    normalizeTransaction(payload) {
      const n = normalizeSePayPayload(payload);
      n.provider = PROVIDER_FIXTURE;
      return n;
    },

    async getPaymentStatus(query) {
      for (const tx of store.transactions.values()) {
        if (query.paymentCode && tx.paymentCode === String(query.paymentCode).toUpperCase()) {
          return { status: 'paid', transaction: tx };
        }
        if (query.providerTxnRef && tx.providerTxnRef === String(query.providerTxnRef)) {
          return { status: 'paid', transaction: tx };
        }
      }
      if (store.offline) return { status: 'offline', error: 'fixture_offline' };
      return { status: 'pending' };
    },

    async reconcilePayment(query) {
      return this.getPaymentStatus(query);
    },

    /** Test helper: inject a normalized inbound transfer. */
    injectTransaction(tx) {
      const n = this.normalizeTransaction(tx);
      store.transactions.set(n.providerEventId, n);
      return n;
    },

    setOffline(flag) {
      store.offline = Boolean(flag);
    },
  };
}

/** Build a signed SePay-compatible fixture webhook for tests. */
export function signFixtureWebhook(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const rawBody = JSON.stringify(payload);
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  return {
    rawBody,
    headers: {
      'x-sepay-signature': signature,
      'x-sepay-timestamp': String(timestamp),
      'content-type': 'application/json',
    },
    timestamp,
    replayWindowSec: WEBHOOK_REPLAY_WINDOW_SEC,
  };
}
