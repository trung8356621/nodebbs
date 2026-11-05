/**
 * Shared VND ↔ Credit formatting for Admin configuration UIs.
 * Ledger stores decimal Credits; Admin always edits VND.
 */

export function parseVndInput(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) return null;
    return value;
  }
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

export function formatVnd(amount, locale = 'vi-VN') {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(locale)} ₫`;
}

/** Exact VND→Credit decimal string (mirrors API BigInt division for display). */
export function vndToCreditAmount(vndAmount, creditVnd, maxScale = 10) {
  const vnd = Number(vndAmount);
  const rate = Number(creditVnd);
  if (!Number.isSafeInteger(vnd) || vnd < 0 || !Number.isSafeInteger(rate) || rate < 1) return null;
  if (vnd === 0) return '0';
  const whole = Math.floor(vnd / rate);
  let rem = vnd % rate;
  if (rem === 0) return String(whole);
  // Display-only long division (same algorithm as API; values stay within SafeInteger for VND).
  let decimals = '';
  while (rem !== 0 && decimals.length < maxScale) {
    rem *= 10;
    decimals += String(Math.floor(rem / rate));
    rem %= rate;
  }
  decimals = decimals.replace(/0+$/, '');
  return decimals ? `${whole}.${decimals}` : String(whole);
}

export function formatCredit(vndAmount, creditVnd, locale = 'vi-VN') {
  const s = vndToCreditAmount(vndAmount, creditVnd);
  if (s == null) return '—';
  return `${formatCreditAmount(s, locale)} Credit`;
}

export function formatCreditAmount(amount, locale = 'vi-VN') {
  if (amount == null || amount === '') return '0';
  const raw = String(amount).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '0';
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const [w, f = ''] = body.split('.');
  const frac = f.replace(/0+$/, '');
  const whole = Number(w || '0').toLocaleString(locale);
  const sep = locale?.startsWith?.('vi') ? ',' : '.';
  const out = frac ? `${whole}${sep}${frac}` : whole;
  return neg && out !== '0' ? `-${out}` : out;
}

export function vndToCreditExact(vndAmount, creditVnd) {
  return vndToCreditAmount(vndAmount, creditVnd);
}
