/**
 * Catalog of local credits.config keys used by activity reward/spend rules.
 * Admin configures amounts in VND; ledger grants/deducts integer Credits.
 * OPS commercial pricing is intentionally excluded.
 */

import { creditToVnd, vndToCreditAmount } from './utils/money.js';

export const REWARD_RULE_CURRENCY = 'credits';

const AMOUNT_MIN_VND = 0;
const AMOUNT_MAX_VND = 1_000_000_000;

/** @typedef {'activity_reward'|'activity_fee'|'limits'|'legacy_unused'} RewardRuleGroup */
/** @typedef {'active'|'unsupported'|'retired'} RewardRuleRuntime */
/** @typedef {'grant'|'deduct'|'validation'|'unused'} RewardRuleEffect */

/**
 * Runtime reflects real handlers (activity-rules-v1), not legacy 410 routes.
 * Tip min/max stay unsupported (no tip product API).
 */
export const REWARD_RULE_DEFS = [
  {
    key: 'check_in_base_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['activityRewardService.checkIn'],
    noteKey: 'ledgerRewardNoteCheckIn',
  },
  {
    key: 'check_in_streak_bonus',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['activityRewardService.checkIn'],
    noteKey: 'ledgerRewardNoteCheckInStreak',
  },
  {
    key: 'post_topic_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['forum/routes/topics'],
    noteKey: 'ledgerRewardNoteTopic',
  },
  {
    key: 'receive_like_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['forum/routes/posts like'],
    noteKey: 'ledgerRewardNoteLike',
  },
  {
    key: 'invite_reward_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['auth/register.js'],
    noteKey: 'ledgerRewardNoteInvite',
  },
  {
    key: 'post_reply_amount',
    group: 'activity_fee',
    effect: 'deduct',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['forum/routes/posts'],
    noteKey: 'ledgerRewardNoteReplyFee',
  },
  {
    key: 'daily_activity_reward_cap_vnd',
    group: 'limits',
    effect: 'validation',
    runtime: 'active',
    editable: true,
    toggleable: true,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['activityRewardService.assertDailyCap'],
    noteKey: 'ledgerRewardNoteDailyCap',
  },
  {
    key: 'reward_min_amount',
    group: 'limits',
    effect: 'validation',
    runtime: 'unsupported',
    editable: true,
    toggleable: false,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['rewards/routes tip (410)'],
    noteKey: 'ledgerRewardNoteRetiredTip',
  },
  {
    key: 'reward_max_amount',
    group: 'limits',
    effect: 'validation',
    runtime: 'unsupported',
    editable: true,
    toggleable: false,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: ['rewards/routes tip (410)'],
    noteKey: 'ledgerRewardNoteRetiredTip',
  },
  {
    key: 'register_amount',
    group: 'legacy_unused',
    effect: 'unused',
    runtime: 'retired',
    editable: false,
    toggleable: false,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: [],
    noteKey: 'ledgerRewardNoteObsolete',
    legacyAliasOf: 'registration_reward_amount',
  },
  {
    key: 'registration_reward_amount',
    group: 'legacy_unused',
    effect: 'unused',
    runtime: 'retired',
    editable: false,
    toggleable: false,
    unit: 'vnd',
    min: AMOUNT_MIN_VND,
    max: AMOUNT_MAX_VND,
    readers: [],
    noteKey: 'ledgerRewardNoteObsolete',
    legacyAliasOf: 'register_amount',
  },
];

/** Groups shown on ledger reward-rules tab (earn/spend only). */
export const REWARD_RULE_UI_GROUPS = new Set(['activity_reward', 'activity_fee']);

/** Groups edited under Settings → Credit & anti-abuse (same credits.config source). */
export const REWARD_LIMIT_UI_GROUPS = new Set(['limits']);

export const ALLOWED_REWARD_RULE_KEYS = new Set(REWARD_RULE_DEFS.map((d) => d.key));

export function parseCurrencyConfig(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  const parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('Invalid currency config JSON'), { statusCode: 400, code: 'invalid_config' });
  }
  return parsed;
}

/**
 * Normalize a config entry to { value, valueUnit, enabled, description }.
 * Legacy integer / {value} without valueUnit is treated as Credit (never auto * 10000).
 * Legacy negative post_reply_amount Credit → positive VND fee via creditVnd at read time.
 */
export function normalizeRuleEntry(raw) {
  if (raw === undefined) return null;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = 'value' in raw ? Number(raw.value) : null;
    return {
      value: Number.isFinite(value) ? value : 0,
      valueUnit: raw.valueUnit === 'vnd' ? 'vnd' : (raw.valueUnit === 'credit' ? 'credit' : inferLegacyUnit(raw)),
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : null,
      description: raw.description || null,
    };
  }
  const value = Number(raw);
  return {
    value: Number.isFinite(value) ? value : 0,
    valueUnit: 'credit',
    enabled: null,
    description: null,
  };
}

function inferLegacyUnit(raw) {
  if (raw?.valueUnit === 'vnd') return 'vnd';
  if (raw?.valueUnit === 'credit') return 'credit';
  // Prefer explicit marker; otherwise legacy Credit.
  return 'credit';
}

export function readConfigValue(item, fallback = null) {
  if (item === undefined) return fallback;
  if (item !== null && typeof item === 'object' && 'value' in item) return item.value;
  return item;
}

export function readRuleEnabled(entry) {
  if (!entry) return false;
  if (typeof entry.enabled === 'boolean') return entry.enabled;
  // Legacy: non-zero means on (reply fee used negative Credit).
  return Number(entry.value) !== 0;
}

/**
 * Absolute VND amount for a rule (fees and grants are non-negative in VND).
 * Legacy Credit values convert via creditVnd without rewriting storage.
 */
export function readRuleValueVnd(entry, creditVnd) {
  if (!entry) return 0;
  const raw = Number(entry.value) || 0;
  if (entry.valueUnit === 'vnd') return Math.abs(raw);
  // Legacy Credit (possibly negative fee)
  return Math.abs(raw) * Number(creditVnd);
}

export function writeConfigValue(existing, { value, valueUnit = 'vnd', enabled, description }) {
  const prev = normalizeRuleEntry(existing) || {};
  const desc = description !== undefined
    ? description
    : (prev.description || (existing && typeof existing === 'object' && existing.description) || undefined);
  const out = {
    value,
    valueUnit,
    enabled: typeof enabled === 'boolean' ? enabled : (typeof prev.enabled === 'boolean' ? prev.enabled : true),
  };
  if (desc) out.description = desc;
  return out;
}

export function resolveRuleRuntime(def) {
  return def.runtime;
}

export function buildRewardRulesView(configObject, { creditVnd = 10000 } = {}) {
  const presentKeys = Object.keys(configObject || {});
  const rate = Number(creditVnd) > 0 ? Number(creditVnd) : 10000;
  const known = REWARD_RULE_DEFS.map((def) => {
    const raw = configObject?.[def.key];
    const entry = normalizeRuleEntry(raw) || { value: 0, valueUnit: 'vnd', enabled: false, description: null };
    const present = Object.prototype.hasOwnProperty.call(configObject || {}, def.key);
    const valueVnd = readRuleValueVnd(entry, rate);
    const valueCredit = valueVnd === 0 ? '0' : vndToCreditAmount(valueVnd, rate);
    const enabled = readRuleEnabled(entry);
    const runtime = resolveRuleRuntime(def);
    const executionLabel = runtime === 'active'
      ? (enabled ? 'active' : 'disabled')
      : runtime === 'retired'
        ? 'retired'
        : 'unsupported';
    return {
      key: def.key,
      group: def.group,
      effect: def.effect,
      runtime,
      editable: def.editable,
      toggleable: Boolean(def.toggleable),
      unit: 'vnd',
      min: def.min,
      max: def.max,
      readers: def.readers,
      noteKey: def.noteKey,
      legacyAliasOf: def.legacyAliasOf || null,
      present,
      /** @deprecated use valueVnd — kept as VND for admin forms */
      value: valueVnd,
      valueVnd,
      valueCredit,
      valueUnitStored: entry.valueUnit,
      enabled,
      creditVnd: rate,
      indivisible: false,
      description: entry.description,
      executionLabel,
    };
  });

  const unknownKeys = presentKeys.filter((k) => !ALLOWED_REWARD_RULE_KEYS.has(k));
  return {
    currency: REWARD_RULE_CURRENCY,
    ownership: 'local',
    creditVnd: rate,
    configUnit: 'vnd',
    engagementGrantsRetired: false,
    activityEngine: 'activity-rules-v1',
    rules: known,
    unknownKeys,
  };
}

function validateRuleValueVnd(def, num, nextConfig, creditVnd) {
  if (!Number.isFinite(num) || !Number.isSafeInteger(num)) {
    throw Object.assign(new Error(`Invalid integer VND value for ${def.key}`), { statusCode: 400, code: 'invalid_value' });
  }
  const min = def.min ?? AMOUNT_MIN_VND;
  const max = def.max ?? AMOUNT_MAX_VND;
  if (num < min || num > max) {
    throw Object.assign(new Error(`${def.key} must be between ${min} and ${max} VND`), {
      statusCode: 400,
      code: 'out_of_bounds',
    });
  }
  // Any non-negative integer VND is valid; Credit may be fractional (NUMERIC ledger).
  if (def.key === 'reward_min_amount' || def.key === 'reward_max_amount') {
    const minEntry = normalizeRuleEntry(
      def.key === 'reward_min_amount' ? { value: num, valueUnit: 'vnd' } : nextConfig.reward_min_amount,
    );
    const maxEntry = normalizeRuleEntry(
      def.key === 'reward_max_amount' ? { value: num, valueUnit: 'vnd' } : nextConfig.reward_max_amount,
    );
    const tipMin = readRuleValueVnd(minEntry, creditVnd);
    const tipMax = readRuleValueVnd(maxEntry, creditVnd);
    if (tipMin > tipMax) {
      throw Object.assign(new Error('reward_min_amount cannot exceed reward_max_amount'), {
        statusCode: 400,
        code: 'invalid_tip_bounds',
      });
    }
  }
}

/**
 * Merge permitted updates. Each update may be:
 * - number → VND value (keeps enabled)
 * - { value?: number, enabled?: boolean }
 */
export function mergeRewardRuleUpdates(existingConfig, updates, { creditVnd = 10000 } = {}) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw Object.assign(new Error('updates must be an object'), { statusCode: 400, code: 'invalid_updates' });
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) {
    throw Object.assign(new Error('No updates provided'), { statusCode: 400, code: 'empty_updates' });
  }
  const unknown = keys.filter((k) => !ALLOWED_REWARD_RULE_KEYS.has(k));
  if (unknown.length) {
    throw Object.assign(new Error(`Unknown reward rule keys: ${unknown.join(', ')}`), {
      statusCode: 400,
      code: 'unknown_keys',
      unknown,
    });
  }
  const readonly = keys.filter((k) => {
    const def = REWARD_RULE_DEFS.find((d) => d.key === k);
    return !def?.editable;
  });
  if (readonly.length) {
    throw Object.assign(new Error(`Read-only reward rule keys: ${readonly.join(', ')}`), {
      statusCode: 400,
      code: 'readonly_keys',
      readonly,
    });
  }

  const rate = Number(creditVnd) > 0 ? Number(creditVnd) : 10000;
  const next = { ...existingConfig };
  const applied = [];
  for (const key of keys) {
    const def = REWARD_RULE_DEFS.find((d) => d.key === key);
    const raw = updates[key];
    const prev = normalizeRuleEntry(existingConfig[key]) || {
      value: 0, valueUnit: 'vnd', enabled: false, description: null,
    };
    let nextVnd = readRuleValueVnd(prev, rate);
    let nextEnabled = readRuleEnabled(prev);

    if (typeof raw === 'number' || (typeof raw === 'string' && raw !== '')) {
      nextVnd = Number(raw);
      validateRuleValueVnd(def, nextVnd, next, rate);
    } else if (raw && typeof raw === 'object') {
      if (raw.value !== undefined) {
        nextVnd = Number(raw.value);
        validateRuleValueVnd(def, nextVnd, next, rate);
      }
      if (typeof raw.enabled === 'boolean') {
        if (!def.toggleable && raw.enabled !== nextEnabled) {
          throw Object.assign(new Error(`${key} cannot be toggled`), {
            statusCode: 400,
            code: 'not_toggleable',
          });
        }
        nextEnabled = raw.enabled;
      }
    } else {
      throw Object.assign(new Error(`Invalid update payload for ${key}`), { statusCode: 400, code: 'invalid_value' });
    }

    next[key] = writeConfigValue(existingConfig[key], {
      value: nextVnd,
      valueUnit: 'vnd',
      enabled: nextEnabled,
    });
    applied.push(key);
  }
  return { nextConfig: next, applied };
}

/** @deprecated helper for tests — Credit→VND display only */
export function legacyCreditToVnd(credit, creditVnd) {
  return creditToVnd(Math.abs(Number(credit) || 0), creditVnd);
}
