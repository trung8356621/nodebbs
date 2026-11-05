import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOURCE_FORUM_BASE,
  SOURCE_OPS_OVERRIDE,
  SOURCE_FREE_MODE,
  SOURCE_OPS_BAN,
  OPS_SERVICE_SYNC_STATUS,
} from '../constants.js';

/**
 * Pure precedence helper mirroring LocalPricingService.resolveEffective.
 * Kept free of DB so CI can run without Postgres.
 */
function resolveEffectivePure({
  enabled = true,
  basePriceVnd = 50000,
  overridePriceVnd = null,
  banned = false,
  freeMode = false,
  policyValid = true,
  vndPerCredit = 10000,
}) {
  if (policyValid && banned) {
    return {
      available: false,
      effectivePriceVnd: null,
      effectiveSource: SOURCE_OPS_BAN,
      effectivePriceCredit: null,
      basePriceVnd,
    };
  }
  let effectivePriceVnd = basePriceVnd;
  let effectiveSource = SOURCE_FORUM_BASE;
  if (policyValid && overridePriceVnd != null) {
    effectivePriceVnd = overridePriceVnd;
    effectiveSource = SOURCE_OPS_OVERRIDE;
  }
  if (freeMode) {
    effectivePriceVnd = 0;
    effectiveSource = SOURCE_FREE_MODE;
  }
  const available = Boolean(enabled);
  const effectivePriceCredit = available
    ? (effectivePriceVnd === 0 ? 0 : Math.ceil(effectivePriceVnd / vndPerCredit))
    : null;
  return {
    available,
    effectivePriceVnd: available ? effectivePriceVnd : null,
    effectiveSource: banned && policyValid ? SOURCE_OPS_BAN : (available ? effectiveSource : SOURCE_FORUM_BASE),
    effectivePriceCredit,
    basePriceVnd,
  };
}

test('precedence: forum base when no OPS policy', () => {
  const r = resolveEffectivePure({ basePriceVnd: 50000 });
  assert.equal(r.effectiveSource, SOURCE_FORUM_BASE);
  assert.equal(r.effectivePriceVnd, 50000);
  assert.equal(r.effectivePriceCredit, 5);
  assert.equal(r.basePriceVnd, 50000);
});

test('precedence: OPS override does not mutate stored base', () => {
  const r = resolveEffectivePure({ basePriceVnd: 50000, overridePriceVnd: 20000 });
  assert.equal(r.effectiveSource, SOURCE_OPS_OVERRIDE);
  assert.equal(r.effectivePriceVnd, 20000);
  assert.equal(r.basePriceVnd, 50000);
  assert.equal(r.effectivePriceCredit, 2);
});

test('precedence: Free Mode zeros effective price without changing base', () => {
  const r = resolveEffectivePure({ basePriceVnd: 50000, overridePriceVnd: 20000, freeMode: true });
  assert.equal(r.effectiveSource, SOURCE_FREE_MODE);
  assert.equal(r.effectivePriceVnd, 0);
  assert.equal(r.effectivePriceCredit, 0);
  assert.equal(r.basePriceVnd, 50000);
});

test('precedence: OPS ban wins over Free Mode and override', () => {
  const r = resolveEffectivePure({
    basePriceVnd: 50000,
    overridePriceVnd: 1000,
    freeMode: true,
    banned: true,
  });
  assert.equal(r.available, false);
  assert.equal(r.effectiveSource, SOURCE_OPS_BAN);
  assert.equal(r.effectivePriceCredit, null);
});

test('expired/invalid policy ignored (falls back to forum base)', () => {
  const r = resolveEffectivePure({
    basePriceVnd: 40000,
    overridePriceVnd: 1000,
    banned: true,
    policyValid: false,
  });
  assert.equal(r.available, true);
  assert.equal(r.effectiveSource, SOURCE_FORUM_BASE);
  assert.equal(r.effectivePriceVnd, 40000);
});

test('OPS outbound sync remains unsupported', () => {
  assert.equal(OPS_SERVICE_SYNC_STATUS.supported, false);
  assert.match(OPS_SERVICE_SYNC_STATUS.reason, /No compatible OPS endpoint/);
});
