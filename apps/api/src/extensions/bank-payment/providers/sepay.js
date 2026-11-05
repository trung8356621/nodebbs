import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PROVIDER_SEPAY,
  SEPAY_API_BASE_LEGACY,
  SEPAY_API_BASE_V2,
  SEPAY_QR_BASE,
  WEBHOOK_REPLAY_WINDOW_SEC,
} from '../constants.js';

/**
 * SePay bank-transfer adapter (VietQR + webhook + transaction lookup).
 * Does not touch Ledger — only payment channel concerns.
 */

function header(headers, name) {
  if (!headers) return '';
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === lower) {
      return Array.isArray(v) ? String(v[0] || '') : String(v || '');
    }
  }
  return '';
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function buildVietQrUrl({ accountNumber, bankCode, amountVnd, paymentCode, accountName }) {
  const params = new URLSearchParams();
  params.set('acc', String(accountNumber || ''));
  params.set('bank', String(bankCode || ''));
  params.set('amount', String(Math.trunc(Number(amountVnd) || 0)));
  params.set('des', String(paymentCode || ''));
  if (accountName) params.set('holder', String(accountName));
  return `${SEPAY_QR_BASE}?${params.toString()}`;
}

export function normalizeSePayPayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const transferType = String(p.transferType || p.transfer_type || '').toLowerCase() || 'in';
  const amountRaw = p.transferAmount ?? p.amount_in ?? p.amountIn ?? p.amount ?? 0;
  const amountVnd = Math.trunc(Number(amountRaw) || 0);
  const providerEventId = String(p.id ?? p.event_id ?? p.providerEventId ?? '');
  const bankTxnRef = p.referenceCode || p.reference_number || p.referenceNumber || null;
  const providerTxnRef = String(
    p.transaction_id
    || p.transactionId
    || bankTxnRef
    || providerEventId
    || '',
  );
  const paymentCode = p.code || p.payment_code || p.paymentCode || null;
  return {
    provider: PROVIDER_SEPAY,
    providerEventId: providerEventId || providerTxnRef,
    providerTxnRef,
    bankTxnRef: bankTxnRef ? String(bankTxnRef) : null,
    paymentCode: paymentCode ? String(paymentCode).toUpperCase() : null,
    transferType,
    amountVnd,
    accountNumber: String(p.accountNumber || p.account_number || ''),
    gateway: p.gateway || p.bank_brand_name || null,
    content: p.content || p.transaction_content || p.description || null,
    transactionDate: p.transactionDate || p.transaction_date || null,
    raw: p,
  };
}

/**
 * Verify SePay HMAC-SHA256 (preferred) or API Key Authorization header.
 * HMAC signs `{timestamp}.{rawBody}` → `sha256={hex}`.
 */
export function verifySePayWebhook({ rawBody, headers, config }) {
  const body = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : JSON.stringify(rawBody || {});

  const signature = header(headers, 'x-sepay-signature');
  const timestamp = header(headers, 'x-sepay-timestamp');
  const secret = config?.webhookSecret || '';

  if (secret && signature) {
    if (!timestamp) {
      return { ok: false, reason: 'forged', detail: 'missing_timestamp' };
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return { ok: false, reason: 'forged', detail: 'bad_timestamp' };
    }
    const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (skew > WEBHOOK_REPLAY_WINDOW_SEC) {
      return { ok: false, reason: 'replay', detail: `skew_${skew}s` };
    }
    const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
    if (!safeEqualHex(expected, signature)) {
      return { ok: false, reason: 'forged', detail: 'bad_signature' };
    }
  } else if (secret || config?.apiKey) {
    // Fallback: API Key header `Authorization: Apikey …`
    const auth = header(headers, 'authorization');
    const expectedKey = secret || config.apiKey;
    const expected = `Apikey ${expectedKey}`;
    if (!auth || !safeEqualHex(auth, expected)) {
      // Also accept Bearer-style if operators misconfigure — still constant-time fail closed.
      return { ok: false, reason: 'forged', detail: 'bad_api_key' };
    }
  } else if (!config?.allowInsecureFixture) {
    return { ok: false, reason: 'missing_secret', detail: 'no_webhook_secret_configured' };
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: 'forged', detail: 'invalid_json' };
  }

  const transaction = normalizeSePayPayload(parsed);
  if (!transaction.providerEventId) {
    return { ok: false, reason: 'forged', detail: 'missing_event_id' };
  }
  return { ok: true, transaction };
}

async function sepayFetch(path, { token, base = SEPAY_API_BASE_V2, query } = {}) {
  if (!token) {
    return { offline: true, error: 'missing_api_token' };
  }
  const url = new URL(path.startsWith('http') ? path : `${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return { offline: res.status >= 500, error: `http_${res.status}`, status: res.status };
    }
    const data = await res.json();
    return { data };
  } catch (err) {
    return { offline: true, error: err.message || 'network_error' };
  }
}

export function createSePayAdapter() {
  return {
    name: PROVIDER_SEPAY,

    async createPaymentRequest(input) {
      const cfg = input.config || {};
      const accountNumber = cfg.accountNumber || '';
      const bankCode = cfg.bankCode || '';
      if (!accountNumber || !bankCode) {
        const err = new Error('SePay accountNumber/bankCode not configured');
        err.code = 'provider_misconfigured';
        err.statusCode = 503;
        throw err;
      }
      const paymentCode = String(input.paymentCode).toUpperCase();
      const amountVnd = Math.trunc(Number(input.amountVnd));
      const qrImageUrl = buildVietQrUrl({
        accountNumber,
        bankCode,
        amountVnd,
        paymentCode,
        accountName: cfg.accountName,
      });
      return {
        provider: PROVIDER_SEPAY,
        paymentCode,
        amountVnd,
        accountNumber,
        bankCode,
        accountName: cfg.accountName || null,
        transferContent: paymentCode,
        qrImageUrl,
        raw: { source: 'sepay_vietqr' },
      };
    },

    async verifyWebhook(input) {
      return verifySePayWebhook(input);
    },

    normalizeTransaction(payload) {
      return normalizeSePayPayload(payload);
    },

    async getPaymentStatus(query, config = {}) {
      const token = config.apiToken || config.apiKey;
      const q = query.paymentCode || query.providerTxnRef || query.orderId;
      // Prefer v2; fall back to legacy list if needed.
      let result = await sepayFetch('/transactions', {
        token,
        base: SEPAY_API_BASE_V2,
        query: {
          q,
          transaction_content: query.paymentCode,
          transfer_type: 'in',
          bank_account_id: config.bankAccountId || undefined,
          per_page: 20,
        },
      });
      if (result.error && result.status === 404) {
        result = await sepayFetch('/transactions/list', {
          token,
          base: SEPAY_API_BASE_LEGACY,
          query: {
            transaction_content: query.paymentCode,
            account_number: config.accountNumber,
            limit: 20,
          },
        });
      }
      if (result.offline) {
        return { status: 'offline', error: result.error };
      }
      if (result.error) {
        return { status: 'unknown', error: result.error };
      }
      const rows = Array.isArray(result.data?.data)
        ? result.data.data
        : Array.isArray(result.data?.transactions)
          ? result.data.transactions
          : Array.isArray(result.data)
            ? result.data
            : [];
      const match = rows.find((row) => {
        const n = normalizeSePayPayload(row);
        if (query.paymentCode && n.paymentCode === String(query.paymentCode).toUpperCase()) return true;
        if (query.providerTxnRef && n.providerTxnRef === String(query.providerTxnRef)) return true;
        if (query.paymentCode && String(n.content || '').toUpperCase().includes(String(query.paymentCode).toUpperCase())) return true;
        return false;
      });
      if (!match) return { status: 'pending' };
      return { status: 'paid', transaction: normalizeSePayPayload(match) };
    },

    async reconcilePayment(query, config = {}) {
      return this.getPaymentStatus(query, config);
    },
  };
}
