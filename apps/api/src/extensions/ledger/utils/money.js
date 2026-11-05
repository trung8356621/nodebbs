/**
 * Shared VND ↔ Credit conversion.
 * Admin configures VND; ledger stores Credit as NUMERIC (decimal string in JS).
 * Never use IEEE float for money math — BigInt long division only.
 */

export const DEFAULT_VND_PER_CREDIT = 10000;
/** Max decimal places stored for Credit amounts (matches NUMERIC scale). */
export const CREDIT_SCALE = 10;

export function parseVndInput(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
      throw Object.assign(new Error('VND must be a non-negative integer'), { statusCode: 400, code: 'invalid_vnd' });
    }
    return value;
  }
  const cleaned = String(value).replace(/[^\d]/g, '');
  if (!cleaned) {
    throw Object.assign(new Error('VND must be a non-negative integer'), { statusCode: 400, code: 'invalid_vnd' });
  }
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw Object.assign(new Error('VND must be a non-negative integer'), { statusCode: 400, code: 'invalid_vnd' });
  }
  return n;
}

export function formatVnd(amount, locale = 'vi-VN') {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(locale)} ₫`;
}

/**
 * Exact Credit = VND / creditVnd as a decimal string (no float).
 * Terminating decimals are exact; non-terminating are stored to CREDIT_SCALE places (PG NUMERIC).
 */
export function vndToCreditAmount(vndAmount, creditVnd, maxScale = CREDIT_SCALE) {
  const vnd = Number(vndAmount);
  const rate = Number(creditVnd);
  if (!Number.isSafeInteger(vnd) || vnd < 0) {
    throw Object.assign(new Error('Invalid VND amount'), { statusCode: 400, code: 'invalid_vnd' });
  }
  if (!Number.isSafeInteger(rate) || rate < 1) {
    throw Object.assign(new Error('Invalid VND-per-Credit'), { statusCode: 409, code: 'INVALID_CONVERSION' });
  }
  if (vnd === 0) return '0';

  const v = BigInt(vnd);
  const r = BigInt(rate);
  const whole = v / r;
  let rem = v % r;
  if (rem === 0n) return whole.toString();

  let decimals = '';
  while (rem !== 0n && decimals.length < maxScale) {
    rem *= 10n;
    decimals += (rem / r).toString();
    rem = rem % r;
  }
  // Trim trailing zeros from terminating expansions that hit maxScale early.
  decimals = decimals.replace(/0+$/, '');
  return decimals ? `${whole.toString()}.${decimals}` : whole.toString();
}

/** @deprecated use vndToCreditAmount — kept for callers expecting null on non-integer */
export function vndToCreditExact(vndAmount, creditVnd) {
  const s = vndToCreditAmount(vndAmount, creditVnd);
  if (!s.includes('.')) return Number(s);
  // Fractional is now allowed; return numeric string via Amount helpers instead.
  return s;
}

export function formatCreditFromVnd(vndAmount, creditVnd, locale = 'vi-VN') {
  try {
    const s = vndToCreditAmount(vndAmount, creditVnd);
    return `${formatCreditAmount(s, locale)} Credit`;
  } catch {
    return '—';
  }
}

export function formatCreditAmount(amount, locale = 'vi-VN') {
  if (amount == null || amount === '') return '—';
  const s = String(amount);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return '—';
  const [w, f] = s.split('.');
  const whole = Number(w).toLocaleString(locale);
  if (!f) return whole;
  return `${whole}${locale.startsWith('vi') ? ',' : '.'}${f}`;
}

export function creditToVnd(creditAmount, creditVnd) {
  const rate = Number(creditVnd);
  if (!Number.isSafeInteger(rate) || rate < 1) {
    throw Object.assign(new Error('Invalid Credit→VND conversion'), { statusCode: 400, code: 'invalid_conversion' });
  }
  // Only for integer Credit display helpers (legacy).
  const credit = Number(creditAmount);
  if (!Number.isSafeInteger(credit)) {
    throw Object.assign(new Error('creditToVnd requires integer Credit'), { statusCode: 400, code: 'invalid_conversion' });
  }
  const vnd = credit * rate;
  if (!Number.isSafeInteger(vnd)) {
    throw Object.assign(new Error('VND overflow'), { statusCode: 400, code: 'vnd_overflow' });
  }
  return vnd;
}

/**
 * Normalize a Credit amount for ledger writes. Accepts number or decimal string.
 * Rejects NaN, negative, zero (for grant/deduct), and scientific notation.
 */
export function normalizeCreditAmount(amount, { allowZero = false } = {}) {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw Object.assign(new Error('Invalid Credit amount'), { statusCode: 400, code: 'invalid_amount' });
    }
    if (Number.isInteger(amount)) {
      if (amount < 0 || (!allowZero && amount === 0)) {
        throw Object.assign(new Error('Credit amount must be positive'), { statusCode: 400, code: 'invalid_amount' });
      }
      return String(amount);
    }
    // Reject binary floats that are not safe integers — require string path for fractions.
    throw Object.assign(
      new Error('Fractional Credit amounts must be provided as exact decimal strings'),
      { statusCode: 400, code: 'invalid_amount' },
    );
  }
  const s = String(amount ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) {
    throw Object.assign(new Error('Invalid Credit amount'), { statusCode: 400, code: 'invalid_amount' });
  }
  const normalized = s.includes('.') ? s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : s;
  const final = normalized === '' ? '0' : normalized;
  if (final === '0' || final === '0.0') {
    if (allowZero) return '0';
    throw Object.assign(new Error('Credit amount must be positive'), { statusCode: 400, code: 'invalid_amount' });
  }
  return final;
}

/** Compare two non-negative decimal strings: -1 / 0 / 1 */
export function compareCreditAmount(a, b) {
  const as = normalizeCreditAmount(a, { allowZero: true });
  const bs = normalizeCreditAmount(b, { allowZero: true });
  const [aw, af = ''] = as.split('.');
  const [bw, bf = ''] = bs.split('.');
  const scale = Math.max(af.length, bf.length);
  const ai = BigInt(aw) * (10n ** BigInt(scale)) + BigInt((af + '0'.repeat(scale)).slice(0, scale) || '0');
  const bi = BigInt(bw) * (10n ** BigInt(scale)) + BigInt((bf + '0'.repeat(scale)).slice(0, scale) || '0');
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

/** Multiply a non-negative Credit amount by a non-negative integer factor. */
export function mulCreditAmount(amount, factor) {
  const n = Number(factor);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw Object.assign(new Error('Invalid Credit factor'), { statusCode: 400, code: 'invalid_amount' });
  }
  if (n === 0) return '0';
  let out = '0';
  for (let i = 0; i < n; i += 1) out = addCreditAmount(out, amount);
  return out;
}

export function addCreditAmount(a, b) {
  const as = normalizeCreditAmount(a, { allowZero: true });
  const bs = normalizeCreditAmount(b, { allowZero: true });
  const [aw, af = ''] = as.split('.');
  const [bw, bf = ''] = bs.split('.');
  const scale = Math.max(af.length, bf.length);
  const ai = BigInt(aw) * (10n ** BigInt(scale)) + BigInt((af + '0'.repeat(scale)).slice(0, scale) || '0');
  const bi = BigInt(bw) * (10n ** BigInt(scale)) + BigInt((bf + '0'.repeat(scale)).slice(0, scale) || '0');
  return scaleCreditFixed(ai + bi, scale);
}

export function subCreditAmount(a, b) {
  const as = normalizeCreditAmount(a, { allowZero: true });
  const bs = normalizeCreditAmount(b, { allowZero: true });
  const [aw, af = ''] = as.split('.');
  const [bw, bf = ''] = bs.split('.');
  const scale = Math.max(af.length, bf.length);
  const ai = BigInt(aw) * (10n ** BigInt(scale)) + BigInt((af + '0'.repeat(scale)).slice(0, scale) || '0');
  const bi = BigInt(bw) * (10n ** BigInt(scale)) + BigInt((bf + '0'.repeat(scale)).slice(0, scale) || '0');
  if (ai < bi) {
    throw Object.assign(new Error('Insufficient funds'), { statusCode: 409, code: 'insufficient_funds' });
  }
  return scaleCreditFixed(ai - bi, scale);
}

function scaleCreditFixed(fixed, scale) {
  if (scale === 0) return fixed.toString();
  const neg = fixed < 0n;
  const v = neg ? -fixed : fixed;
  const base = 10n ** BigInt(scale);
  const whole = v / base;
  let frac = (v % base).toString().padStart(scale, '0').replace(/0+$/, '');
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

/** Coerce DB numeric/bigint driver values to decimal string (may be negative for tx amounts). */
export function creditFromDb(value) {
  if (value == null) return '0';
  if (typeof value === 'bigint') return value.toString();
  let s;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    if (Number.isInteger(value)) return String(value);
    s = value.toFixed(CREDIT_SCALE).replace(/\.?0+$/, '') || '0';
  } else {
    s = String(value).trim();
  }
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(body)) return '0';
  const normalized = body.includes('.')
    ? body.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    : body;
  const final = normalized === '' ? '0' : normalized;
  if (final === '0') return '0';
  return neg ? `-${final}` : final;
}
