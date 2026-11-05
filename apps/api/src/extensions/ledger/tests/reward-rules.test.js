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
import { AUTOMATIC_CREDIT_TYPES, rejectEngagementCredit } from '../engagement.js';

const FIXTURE_CONFIG = {
  check_in_base_amount: { value: 0, description: '签到基础奖励' },
  check_in_streak_bonus: { value: 0, description: '连续签到每日递增奖励' },
  post_topic_amount: { value: 0, description: '发布话题奖励' },
  post_reply_amount: { value: 0, description: '发布回复的积分变动' },
  receive_like_amount: { value: 0, description: '获赞奖励' },
  reward_min_amount: { value: 1, description: '打赏最小金额' },
  reward_max_amount: { value: 1000, description: '打赏最大金额' },
  invite_reward_amount: { value: 0, description: '邀请新用户奖励' },
  register_amount: 0,
  registration_reward_amount: 0,
};

test('catalog covers seeded + legacy DB keys', () => {
  for (const key of Object.keys(FIXTURE_CONFIG)) {
    assert.ok(ALLOWED_REWARD_RULE_KEYS.has(key), `missing def for ${key}`);
  }
  assert.ok(REWARD_RULE_DEFS.length >= 10);
});

test('merge updates editable keys and preserves descriptions', () => {
  const { nextConfig, applied } = mergeRewardRuleUpdates(FIXTURE_CONFIG, {
    post_reply_amount: -1,
  });
  assert.deepEqual(applied, ['post_reply_amount']);
  assert.equal(nextConfig.post_reply_amount.value, -1);
  assert.equal(nextConfig.post_reply_amount.description, '发布回复的积分变动');
  assert.equal(nextConfig.reward_max_amount.value, 1000);
});

test('merge rejects unknown keys', () => {
  assert.throws(
    () => mergeRewardRuleUpdates(FIXTURE_CONFIG, { invented_bonus: 99 }),
    /Unknown reward rule keys/,
  );
});

test('merge allows persist-only edits for retired keys without reactivating runtime', () => {
  const { nextConfig, applied } = mergeRewardRuleUpdates(FIXTURE_CONFIG, {
    check_in_base_amount: 3,
  });
  assert.deepEqual(applied, ['check_in_base_amount']);
  assert.equal(nextConfig.check_in_base_amount.value, 3);
  const view = buildRewardRulesView(nextConfig);
  const checkIn = view.rules.find((r) => r.key === 'check_in_base_amount');
  assert.equal(checkIn.runtime, 'retired');
  assert.equal(checkIn.editable, true);
});

test('merge rejects out-of-bounds values', () => {
  assert.throws(
    () => mergeRewardRuleUpdates(FIXTURE_CONFIG, { check_in_base_amount: -1 }),
    /must be between/,
  );
});

test('identity-style omit: parse + view leave values intact', () => {
  const parsed = parseCurrencyConfig(JSON.stringify(FIXTURE_CONFIG));
  const view = buildRewardRulesView(parsed);
  assert.equal(view.currency, 'credits');
  assert.equal(view.engagementGrantsRetired, true);
  const checkIn = view.rules.find((r) => r.key === 'check_in_base_amount');
  assert.equal(checkIn.runtime, 'retired');
  assert.equal(checkIn.value, 0);
});

test('post_reply_amount runtime flips with sign', () => {
  const def = REWARD_RULE_DEFS.find((d) => d.key === 'post_reply_amount');
  assert.equal(resolveRuleRuntime(def, 0), 'not_wired');
  assert.equal(resolveRuleRuntime(def, 2), 'not_wired');
  assert.equal(resolveRuleRuntime(def, -1), 'active');
});

test('engagement grant types remain rejected (410)', () => {
  for (const type of ['check_in', 'post_topic', 'post_reply', 'receive_like', 'invite_user']) {
    assert.ok(AUTOMATIC_CREDIT_TYPES.has(type));
    assert.throws(
      () => rejectEngagementCredit({ currencyCode: 'credits', type }),
      (err) => err.statusCode === 410,
    );
  }
});
