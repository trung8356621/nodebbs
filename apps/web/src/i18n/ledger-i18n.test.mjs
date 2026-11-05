import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createTranslator } from 'next-intl';
import english from './messages/en-US.json' with { type: 'json' };
import vietnamese from './messages/vi-VN.json' with { type: 'json' };
import namespaces from './namespaces.json' with { type: 'json' };

const REQUIRED = [
  'ledgerAdminDescription',
  'ledgerTabServices',
  'ledgerTabServiceHistory',
  'ledgerServiceSeoTitle',
  'ledgerServicePinTitle',
  'ledgerServicePackTitle',
  'ledgerServicesIntro',
  'ledgerOpsStoreMissing',
  'ledgerOpsCatalogReady',
  'ledgerHistoryIntro',
  'ledgerHistoryForbidden',
  'ledgerConversion',
  'ledgerConversionMissing',
  'ledgerRewardRulesTitle',
  'ledgerRewardKey_check_in_base_amount',
  'ledgerRewardKey_post_reply_amount',
  'ledgerCurrencyIdentityHint',
  'ledgerTabServicesRules',
  'ledgerTabRewardRules',
  'ledgerRewardLimitsSettingsLink',
  'ledgerRewardKey_daily_activity_reward_cap_vnd',
  'creditAbuseNavLabel',
  'ledgerServicesTableTitle',
  'ledgerRewardColAction',
  'ledgerRewardSectionHint',
  'txOpsCreditGrant',
  'pinFailure_INSUFFICIENT',
  'pinCatalogUnavailable',
];

function messagesFor(locale) {
  if (locale !== 'vi-VN') return english;
  return Object.fromEntries(Object.entries(english).map(([namespace, messages]) => [
    namespace, { ...messages, ...vietnamese[namespace] },
  ]));
}

function translate(locale, key, values) {
  const t = createTranslator({ locale, messages: messagesFor(locale) });
  return t(`${namespaces[key] || 'common'}.${key}`, values);
}

test('ledger consolidation keys exist in en-US, vi-VN, and namespaces', () => {
  for (const key of REQUIRED) {
    assert.equal(namespaces[key], 'common', `namespace for ${key}`);
    assert.equal(typeof english.common[key], 'string', `en ${key}`);
    assert.equal(typeof vietnamese.common[key], 'string', `vi ${key}`);
    assert.ok(english.common[key].length > 0);
    assert.ok(vietnamese.common[key].length > 0);
  }
});

test('translator does not return literal common.<key> for ledger strings', () => {
  for (const locale of ['en-US', 'vi-VN']) {
    for (const key of REQUIRED) {
      const value = translate(locale, key, { days: 7, months: 1, credits: 10, authority: 'legacy' });
      assert.notEqual(value, `common.${key}`, `${locale} ${key} unresolved`);
      assert.equal(/^common\./.test(value), false, `${locale} ${key} => ${value}`);
    }
  }
});

test('LedgerPaidServices and LedgerServiceHistory only reference known common keys', () => {
  const files = [
    path.join(import.meta.dirname, '../extensions/ledger/components/admin/LedgerPaidServices.jsx'),
    path.join(import.meta.dirname, '../extensions/ledger/components/admin/LedgerServiceHistory.jsx'),
    path.join(import.meta.dirname, '../extensions/ledger/components/admin/LedgerRewardRules.jsx'),
    path.join(import.meta.dirname, '../extensions/ledger/components/admin/LedgerCurrencies.jsx'),
    path.join(import.meta.dirname, '../extensions/ledger/pages/admin/LedgerAdminPage.jsx'),
  ];
  const keyRe = /\bt\(['"]([a-zA-Z0-9_]+)['"]/g;
  const missing = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = keyRe.exec(src))) {
      const key = m[1];
      if (!namespaces[key] && !english.common[key] && !vietnamese.common[key]) {
        // allow existing non-ledger keys that live in common via namespaces
        if (!namespaces[key]) missing.push(`${path.basename(file)}:${key}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
