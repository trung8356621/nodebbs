import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLOWED_REWARD_RULE_KEYS,
  REWARD_RULE_DEFS,
  buildRewardRulesView,
  mergeRewardRuleUpdates,
  parseCurrencyConfig,
  resolveRuleRuntime,
} from '../rewardRules.js';
import { ACTIVITY_RULES_ENGINE, AUTOMATIC_CREDIT_TYPES, rejectEngagementCredit } from '../engagement.js';
import {
  addCreditAmount,
  compareCreditAmount,
  formatCreditFromVnd,
  normalizeCreditAmount,
  vndToCreditAmount,
} from '../utils/money.js';

const FIXTURE_CONFIG = {
  check_in_base_amount: { value: 0, description: 'Check-in base reward' },
  check_in_streak_bonus: { value: 0, description: 'Daily streak bonus increment' },
  post_topic_amount: { value: 0, description: 'Topic create reward' },
  post_reply_amount: { value: 0, description: 'Reply credit delta' },
  receive_like_amount: { value: 0, description: 'Receive-like reward' },
  daily_activity_reward_cap_vnd: { value: 1_000_000, valueUnit: 'vnd', enabled: true },
  reward_min_amount: { value: 1, description: 'Tip minimum amount' },
  reward_max_amount: { value: 1000, description: 'Tip maximum amount' },
  invite_reward_amount: { value: 0, description: 'Invite new user reward' },
  register_amount: 0,
  registration_reward_amount: 0,
};

test('catalog covers seeded + legacy DB keys', () => {
  for (const key of Object.keys(FIXTURE_CONFIG)) {
    assert.ok(ALLOWED_REWARD_RULE_KEYS.has(key), `missing def for ${key}`);
  }
});

test('merge accepts fractional Credit VND amounts (5000, 2000, 0)', () => {
  for (const vnd of [0, 1000, 2000, 5000, 10000, 50000]) {
    const { nextConfig } = mergeRewardRuleUpdates(FIXTURE_CONFIG, {
      check_in_streak_bonus: vnd,
    }, { creditVnd: 10000 });
    assert.equal(nextConfig.check_in_streak_bonus.value, vnd);
    assert.equal(nextConfig.check_in_streak_bonus.valueUnit, 'vnd');
  }
});

test('merge rejects unknown keys', () => {
  assert.throws(
    () => mergeRewardRuleUpdates(FIXTURE_CONFIG, { invented_bonus: 99 }),
    /Unknown reward rule keys/,
  );
});

test('view exposes exact fractional Credit reference', () => {
  const { nextConfig } = mergeRewardRuleUpdates(FIXTURE_CONFIG, {
    check_in_streak_bonus: { value: 5000, enabled: true },
  }, { creditVnd: 10000 });
  const view = buildRewardRulesView(nextConfig, { creditVnd: 10000 });
  const rule = view.rules.find((r) => r.key === 'check_in_streak_bonus');
  assert.equal(rule.valueVnd, 5000);
  assert.equal(rule.valueCredit, '0.5');
  assert.equal(rule.indivisible, false);
  assert.equal(rule.runtime, 'active');
});

test('money helpers: exact fractional Credits without float', () => {
  assert.equal(vndToCreditAmount(50000, 10000), '5');
  assert.equal(vndToCreditAmount(5000, 10000), '0.5');
  assert.equal(vndToCreditAmount(2000, 10000), '0.2');
  assert.equal(vndToCreditAmount(1000, 10000), '0.1');
  assert.equal(vndToCreditAmount(0, 10000), '0');
  assert.equal(normalizeCreditAmount('0.5'), '0.5');
  assert.equal(addCreditAmount('0.5', '0.5'), '1');
  assert.equal(compareCreditAmount('0.2', '0.5'), -1);
  assert.match(formatCreditFromVnd(5000, 10000, 'en-US'), /0\.5/);
});

test('engagement grants allowed with activity-rules engine marker', () => {
  assert.doesNotThrow(() => rejectEngagementCredit({
    currencyCode: 'credits',
    type: 'check_in',
    metadata: { engine: ACTIVITY_RULES_ENGINE },
  }));
  for (const type of ['check_in', 'post_topic']) {
    assert.ok(AUTOMATIC_CREDIT_TYPES.has(type));
    assert.throws(
      () => rejectEngagementCredit({ currencyCode: 'credits', type }),
      (err) => err.statusCode === 410,
    );
  }
});

test('active grant rules report active runtime', () => {
  for (const key of ['check_in_base_amount', 'post_topic_amount', 'post_reply_amount', 'daily_activity_reward_cap_vnd']) {
    const def = REWARD_RULE_DEFS.find((d) => d.key === key);
    assert.equal(resolveRuleRuntime(def), 'active');
  }
});

test('legacy keys are retired and non-editable', () => {
  for (const key of ['register_amount', 'registration_reward_amount']) {
    const def = REWARD_RULE_DEFS.find((d) => d.key === key);
    assert.equal(def.runtime, 'retired');
    assert.equal(def.editable, false);
    assert.equal(def.toggleable, false);
  }
  assert.throws(
    () => mergeRewardRuleUpdates(FIXTURE_CONFIG, { register_amount: { value: 1000 } }),
    /Read-only reward rule keys/,
  );
});

test('parse + view leave identity intact', () => {
  const parsed = parseCurrencyConfig(JSON.stringify(FIXTURE_CONFIG));
  const view = buildRewardRulesView(parsed, { creditVnd: 10000 });
  assert.equal(view.configUnit, 'vnd');
  assert.equal(view.activityEngine, 'activity-rules-v1');
});
