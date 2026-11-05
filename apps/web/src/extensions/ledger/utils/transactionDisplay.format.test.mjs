/**
 * Display-only formatter checks (no React / Next aliases). Run:
 *   node --test apps/web/src/extensions/ledger/utils/transactionDisplay.format.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCreditAmount } from './money.js';
import {
  amountToneClass,
  formatSignedCredit,
  formatSignedVnd,
  presentAmountCell,
  presentBalanceCell,
} from './transactionValueFormat.js';

test('formatCreditAmount trims trailing zeros', () => {
  assert.equal(formatCreditAmount('28.0000000000', 'vi-VN'), '28');
  assert.equal(formatCreditAmount('0.5000', 'vi-VN'), '0,5');
  assert.equal(formatCreditAmount('0', 'vi-VN'), '0');
});

test('signed Credit / VND zero is neutral tone', () => {
  assert.equal(formatSignedCredit('0', 'vi-VN').text, '0 Credit');
  assert.equal(formatSignedCredit('0', 'vi-VN').tone, 'zero');
  assert.equal(formatSignedVnd('0', 'vi-VN').text, '0 đ');
  assert.equal(formatSignedVnd(0, 'vi-VN').tone, 'zero');
  assert.equal(amountToneClass('zero'), 'text-muted-foreground');
  assert.notEqual(amountToneClass('zero'), amountToneClass('debit'));
});

test('legacy debit shows Credit primary, never em-dash', () => {
  const cell = presentAmountCell({
    amountCredit: '-3',
    amountVnd: null,
    legacyVndUnknown: true,
  }, 'vi-VN');
  assert.equal(cell.primary, '−3 Credit');
  assert.equal(cell.legacy, true);
  assert.equal(cell.missingVnd, true);
  assert.ok(!String(cell.primary).includes('—'));
});

test('legacy grant shows +Credit', () => {
  const cell = presentAmountCell({ amountCredit: '40', amountVnd: null }, 'vi-VN');
  assert.equal(cell.primary, '+40 Credit');
});

test('VND snapshot is primary with Credit secondary', () => {
  const cell = presentAmountCell({
    amountCredit: '-0.5',
    amountVnd: '-5000',
  }, 'vi-VN');
  assert.equal(cell.primary, '−5.000 đ');
  assert.equal(cell.secondary, '−0,5 Credit');
  assert.equal(cell.legacy, false);
});

test('balance after prefers Credit when VND missing', () => {
  const cell = presentBalanceCell({
    balanceAfterCredit: '28.0000000000',
    balanceAfterVnd: null,
  }, 'vi-VN');
  assert.equal(cell.primary, '28 Credit');
  assert.equal(cell.legacy, true);
  assert.ok(!String(cell.primary).includes('—'));
});

test('balance after VND when snapshotted', () => {
  const cell = presentBalanceCell({
    balanceAfterCredit: '9.5',
    balanceAfterVnd: '95000',
  }, 'vi-VN');
  assert.equal(cell.primary, '95.000 đ');
  assert.equal(cell.legacy, false);
});
