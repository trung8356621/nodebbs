/**
 * Display-only enrichment for ledger transactions.
 * Stored unit = Credit (NUMERIC). VND is derived ONLY from metadata snapshots.
 * Never revalue history with the current Forum rate.
 */

import { addCreditAmount, creditFromDb, subCreditAmount } from './money.js';

export function parseTxMetadata(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Multiply a Credit decimal string by integer VND-per-Credit → integer/decimal VND string.
 */
export function creditToVndAmount(creditAmount, creditVnd) {
  const rate = Number(creditVnd);
  if (!Number.isSafeInteger(rate) || rate < 1) return null;
  const raw = String(creditAmount ?? '0').trim();
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(body)) return null;
  const [w, f = ''] = body.split('.');
  const scale = f.length;
  const fixed = BigInt(w) * (10n ** BigInt(scale)) + BigInt(f || '0');
  const vndFixed = fixed * BigInt(rate);
  // Result scale stays `scale` (Credit decimals); trim trailing zeros.
  if (scale === 0) {
    const s = vndFixed.toString();
    return neg ? `-${s}` : s;
  }
  const base = 10n ** BigInt(scale);
  const whole = vndFixed / base;
  let frac = (vndFixed % base).toString().padStart(scale, '0').replace(/0+$/, '');
  const out = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${out}` : out;
}

function signOfCredit(amountCredit) {
  const s = String(amountCredit);
  if (s === '0' || s === '0.0') return 0;
  return s.startsWith('-') ? -1 : 1;
}

/**
 * Build Admin/UI presentation fields without mutating stored ledger values.
 */
export function enrichTransactionForDisplay(row) {
  const metadata = parseTxMetadata(row.metadata);
  const amountCredit = creditFromDb(row.amount);
  const balanceAfterCredit = creditFromDb(row.balance ?? row.balanceAfter);
  const sign = signOfCredit(amountCredit);

  const snapshotRate = (() => {
    const candidates = [metadata.creditVnd, metadata.vndPerCredit, metadata.credit_vnd];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isSafeInteger(n) && n >= 1) return n;
    }
    return null;
  })();

  let amountVnd = null;
  let balanceAfterVnd = null;
  let vndSource = 'legacy_unknown';

  // Prefer explicit value snapshots (never invent from the live Forum rate).
  // Aliases: activity valueVnd, pin priceVnd, OPS amountVnd — display-only, no DB rewrite.
  const valueCandidates = [metadata.valueVnd, metadata.priceVnd, metadata.amountVnd];
  for (const candidate of valueCandidates) {
    if (candidate == null || !Number.isFinite(Number(candidate))) continue;
    const absVnd = Math.abs(Number(candidate));
    if (!Number.isSafeInteger(absVnd)) continue;
    amountVnd = sign < 0 ? `-${absVnd}` : (sign === 0 ? '0' : String(absVnd));
    vndSource = 'snapshot_value_vnd';
    break;
  }

  if (amountVnd == null && snapshotRate != null) {
    amountVnd = creditToVndAmount(amountCredit, snapshotRate);
    balanceAfterVnd = creditToVndAmount(balanceAfterCredit, snapshotRate);
    vndSource = 'snapshot_rate';
  } else if (amountVnd != null && snapshotRate != null) {
    balanceAfterVnd = creditToVndAmount(balanceAfterCredit, snapshotRate);
  }

  // Committed balanceAfterCredit in metadata is authoritative for display of Credit balance,
  // but the column value already is the source of truth — do not recompute from current account.

  let balanceBeforeCredit = null;
  try {
    // after = before + amount  ⇒  before = after - amount
    balanceBeforeCredit = sign >= 0
      ? subCreditAmount(balanceAfterCredit, amountCredit)
      : addCreditAmount(balanceAfterCredit, amountCredit.replace(/^-/, ''));
  } catch {
    balanceBeforeCredit = null;
  }

  let balanceBeforeVnd = null;
  if (balanceBeforeCredit != null && snapshotRate != null) {
    balanceBeforeVnd = creditToVndAmount(balanceBeforeCredit, snapshotRate);
  }

  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    currencyCode: row.currencyCode,
    currencyName: row.currencyName,
    type: row.type,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    description: row.description,
    createdAt: row.createdAt,
    metadata,
    amountCredit,
    balanceAfterCredit,
    balanceBeforeCredit,
    amountVnd,
    balanceAfterVnd,
    balanceBeforeVnd,
    snapshotCreditVnd: snapshotRate,
    vndSource,
    legacyVndUnknown: vndSource === 'legacy_unknown',
    direction: sign > 0 ? 'credit' : sign < 0 ? 'debit' : 'zero',
    amount: amountCredit,
    balance: balanceAfterCredit,
  };
}
