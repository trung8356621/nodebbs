import assert from 'node:assert/strict';
import test from 'node:test';
import {
  creditToVndAmount,
  enrichTransactionForDisplay,
} from '../utils/transactionDisplay.js';

test('creditToVndAmount multiplies fractional Credits exactly', () => {
  assert.equal(creditToVndAmount('0.5', 10000), '5000');
  assert.equal(creditToVndAmount('-3', 10000), '-30000');
  assert.equal(creditToVndAmount('0.2', 10000), '2000');
});

test('legacy row without snapshot leaves amountVnd null', () => {
  const view = enrichTransactionForDisplay({
    id: 1,
    amount: '40',
    balance: '40',
    type: 'admin_grant',
    description: 'Phase23B dedicated acceptance funding',
    metadata: null,
  });
  assert.equal(view.amountCredit, '40');
  assert.equal(view.amountVnd, null);
  assert.equal(view.balanceAfterCredit, '40');
  assert.equal(view.balanceAfterVnd, null);
  assert.equal(view.legacyVndUnknown, true);
  assert.equal(view.direction, 'credit');
});

test('legacy debit keeps Credit figures without inventing VND', () => {
  const view = enrichTransactionForDisplay({
    id: 11,
    amount: '-3',
    balanceAfter: '28',
    type: 'post_reply',
    metadata: null,
  });
  assert.equal(view.amountCredit, '-3');
  assert.equal(view.balanceAfterCredit, '28');
  assert.equal(view.amountVnd, null);
  assert.equal(view.legacyVndUnknown, true);
  assert.equal(view.direction, 'debit');
});

test('snapshot rate derives VND without using current Forum rate', () => {
  const view = enrichTransactionForDisplay({
    id: 2,
    amount: '-0.5',
    balanceAfter: '9.5',
    type: 'post_reply',
    metadata: JSON.stringify({ creditVnd: 10000, valueVnd: 5000, engine: 'activity-rules-v1' }),
  });
  assert.equal(view.amountVnd, '-5000');
  assert.equal(view.balanceAfterVnd, '95000');
  assert.equal(view.snapshotCreditVnd, 10000);
  assert.equal(view.legacyVndUnknown, false);
  assert.equal(view.direction, 'debit');
});

test('pin priceVnd alias becomes amountVnd without DB rewrite', () => {
  const view = enrichTransactionForDisplay({
    id: 3,
    amount: '-5',
    balanceAfter: '10',
    type: 'pin_purchase',
    metadata: { priceVnd: 50000, skuCode: 'pin_7d' },
  });
  assert.equal(view.amountVnd, '-50000');
  assert.equal(view.legacyVndUnknown, false);
  assert.equal(view.balanceAfterVnd, null); // no rate → balance stays Credit-only
});

test('zero amount stays zero direction', () => {
  const view = enrichTransactionForDisplay({
    id: 4,
    amount: '0',
    balanceAfter: '12',
    type: 'test_fixture',
    metadata: { creditVnd: 10000, valueVnd: 0 },
  });
  assert.equal(view.direction, 'zero');
  assert.equal(view.amountVnd, '0');
  assert.equal(view.balanceAfterVnd, '120000');
});

test('changing rate metadata on a different row does not revalue legacy', () => {
  const legacy = enrichTransactionForDisplay({
    id: 5,
    amount: '-3',
    balanceAfter: '28',
    type: 'post_reply',
    metadata: null,
  });
  const newer = enrichTransactionForDisplay({
    id: 6,
    amount: '-3',
    balanceAfter: '25',
    type: 'post_reply',
    metadata: { creditVnd: 20000, valueVnd: 60000 },
  });
  assert.equal(legacy.amountVnd, null);
  assert.equal(newer.amountVnd, '-60000');
  assert.equal(newer.snapshotCreditVnd, 20000);
});
