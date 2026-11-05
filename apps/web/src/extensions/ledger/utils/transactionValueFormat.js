/**
 * Pure amount/balance formatters for ledger history cells.
 * No i18n / Next aliases — safe for node:test.
 */

import { formatCreditAmount, formatVnd } from './money.js';

export function parseAmountNumber(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeVndLabel(text) {
  return String(text || '').replace(/\s*₫\s*$/, ' đ').trim();
}

export function formatSignedVnd(amountVnd, locale = 'vi-VN') {
  if (amountVnd == null || amountVnd === '') {
    return { text: null, tone: 'neutral', legacy: true, missing: true };
  }
  const n = parseAmountNumber(amountVnd);
  if (n === 0) {
    return { text: normalizeVndLabel(formatVnd(0, locale)) || '0 đ', tone: 'zero', legacy: false, missing: false };
  }
  const abs = normalizeVndLabel(formatVnd(Math.abs(n), locale));
  if (n > 0) return { text: `+${abs}`, tone: 'credit', legacy: false, missing: false };
  return { text: `−${abs}`, tone: 'debit', legacy: false, missing: false };
}

export function formatUnsignedVnd(amountVnd, locale = 'vi-VN') {
  if (amountVnd == null || amountVnd === '') return null;
  return normalizeVndLabel(formatVnd(parseAmountNumber(amountVnd), locale)) || '0 đ';
}

export function formatSignedCredit(amountCredit, locale = 'vi-VN') {
  const n = parseAmountNumber(amountCredit);
  const body = formatCreditAmount(String(amountCredit ?? '0'), locale).replace(/^-/, '');
  if (n === 0) return { text: `0 Credit`, tone: 'zero' };
  if (n > 0) return { text: `+${body} Credit`, tone: 'credit' };
  return { text: `−${body} Credit`, tone: 'debit' };
}

export function formatUnsignedCredit(amountCredit, locale = 'vi-VN') {
  const body = formatCreditAmount(String(amountCredit ?? '0'), locale).replace(/^-/, '');
  return `${body} Credit`;
}

export function amountToneClass(tone) {
  if (tone === 'credit') return 'text-green-600 dark:text-green-400';
  if (tone === 'debit') return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

/**
 * Amount cell: exact VND when snapshotted; otherwise Credit as primary (no bare em-dash).
 */
export function presentAmountCell(row, locale = 'vi-VN') {
  const credit = formatSignedCredit(row?.amountCredit ?? row?.amount, locale);
  const vnd = formatSignedVnd(row?.amountVnd, locale);

  if (!vnd.missing) {
    return {
      primary: vnd.text,
      tone: vnd.tone,
      secondary: credit.text,
      legacy: false,
      missingVnd: false,
    };
  }

  if (row?.amountCredit != null && row.amountCredit !== '') {
    return {
      primary: credit.text,
      tone: credit.tone,
      secondary: null,
      legacy: true,
      missingVnd: true,
    };
  }

  return {
    primary: null,
    tone: 'neutral',
    secondary: null,
    legacy: true,
    missingVnd: true,
  };
}

/**
 * Balance-after cell: VND when snapshotted; else committed Credit balance (no bare em-dash).
 */
export function presentBalanceCell(row, locale = 'vi-VN') {
  const vndText = formatUnsignedVnd(row?.balanceAfterVnd, locale);
  if (vndText != null) {
    return {
      primary: vndText,
      secondary: row?.balanceAfterCredit != null
        ? formatUnsignedCredit(row.balanceAfterCredit, locale)
        : null,
      legacy: false,
      missing: false,
    };
  }

  if (row?.balanceAfterCredit != null && row.balanceAfterCredit !== '') {
    return {
      primary: formatUnsignedCredit(row.balanceAfterCredit, locale),
      secondary: null,
      legacy: true,
      missing: false,
    };
  }

  return {
    primary: null,
    secondary: null,
    legacy: true,
    missing: true,
  };
}
