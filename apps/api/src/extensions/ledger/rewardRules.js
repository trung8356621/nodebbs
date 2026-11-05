/**
 * Catalog of local credits.config keys used by activity reward/spend rules.
 * OPS commercial pricing is intentionally excluded.
 */

export const REWARD_RULE_CURRENCY = 'credits';

const AMOUNT_MIN = -1_000_000;
const AMOUNT_MAX = 1_000_000;

/** @typedef {'activity_reward'|'activity_fee'|'limits'|'legacy_unused'} RewardRuleGroup */
/** @typedef {'retired'|'active'|'not_wired'} RewardRuleRuntime */
/** @typedef {'grant'|'deduct'|'validation'|'unused'} RewardRuleEffect */

/**
 * Known keys that may appear in sys_currencies.config for credits.
 * Runtime status reflects wiring today — editing values does not reactivate 410 handlers.
 * All known numeric keys are editable (persist-only when runtime !== active).
 */
export const REWARD_RULE_DEFS = [
  {
    key: 'check_in_base_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'retired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: ['rewardService.checkIn'],
    noteKey: 'ledgerRewardNoteRetiredGrant',
  },
  {
    key: 'check_in_streak_bonus',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'retired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: ['rewardService.checkIn'],
    noteKey: 'ledgerRewardNoteRetiredGrant',
  },
  {
    key: 'post_topic_amount',
    group: 'activity_reward',
    effect: 'unused',
    runtime: 'not_wired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: [],
    noteKey: 'ledgerRewardNoteNotWired',
  },
  {
    key: 'receive_like_amount',
    group: 'activity_reward',
    effect: 'unused',
    runtime: 'not_wired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: [],
    noteKey: 'ledgerRewardNoteNotWired',
  },
  {
    key: 'invite_reward_amount',
    group: 'activity_reward',
    effect: 'grant',
    runtime: 'retired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: ['auth/register.js (gated off)', 'invitations/index.js (display)'],
    noteKey: 'ledgerRewardNoteRetiredGrant',
  },
  {
    key: 'register_amount',
    group: 'legacy_unused',
    effect: 'unused',
    runtime: 'not_wired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: [],
    noteKey: 'ledgerRewardNoteObsolete',
    legacyAliasOf: 'registration_reward_amount',
  },
  {
    key: 'registration_reward_amount',
    group: 'legacy_unused',
    effect: 'unused',
    runtime: 'not_wired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: [],
    noteKey: 'ledgerRewardNoteObsolete',
    legacyAliasOf: 'register_amount',
  },
  {
    key: 'post_reply_amount',
    group: 'activity_fee',
    effect: 'deduct',
    runtime: 'active',
    editable: true,
    unit: 'credit',
    min: AMOUNT_MIN,
    max: AMOUNT_MAX,
    readers: ['forum/routes/posts/index.js'],
    noteKey: 'ledgerRewardNoteReplyFee',
  },
  {
    key: 'reward_min_amount',
    group: 'limits',
    effect: 'validation',
    runtime: 'retired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: ['rewards/routes tip (410)', 'RewardDialog.jsx'],
    noteKey: 'ledgerRewardNoteRetiredTip',
  },
  {
    key: 'reward_max_amount',
    group: 'limits',
    effect: 'validation',
    runtime: 'retired',
    editable: true,
    unit: 'credit',
    min: 0,
    max: AMOUNT_MAX,
    readers: ['rewards/routes tip (410)', 'RewardDialog.jsx'],
    noteKey: 'ledgerRewardNoteRetiredTip',
  },
];

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

export function readConfigValue(item, fallback = null) {
  if (item === undefined) return fallback;
  if (item !== null && typeof item === 'object' && 'value' in item) return item.value;
  return item;
}

export function writeConfigValue(existing, value, description) {
  const desc = (existing && typeof existing === 'object' && existing.description)
    || description
    || undefined;
  if (desc) return { value, description: desc };
  return { value };
}

/**
 * Resolve runtime for post_reply_amount: only negative values deduct today.
 */
export function resolveRuleRuntime(def, value) {
  if (def.key === 'post_reply_amount') {
    if (typeof value === 'number' && value < 0) return 'active';
    return 'not_wired';
  }
  return def.runtime;
}

export function buildRewardRulesView(configObject) {
  const presentKeys = Object.keys(configObject || {});
  const known = REWARD_RULE_DEFS.map((def) => {
    const raw = configObject?.[def.key];
    const value = readConfigValue(raw, null);
    const present = Object.prototype.hasOwnProperty.call(configObject || {}, def.key);
    const runtime = resolveRuleRuntime(def, value);
    return {
      key: def.key,
      group: def.group,
      effect: def.effect,
      runtime,
      editable: def.editable,
      unit: def.unit,
      min: def.min,
      max: def.max,
      readers: def.readers,
      noteKey: def.noteKey,
      legacyAliasOf: def.legacyAliasOf || null,
      present,
      value,
      description: (raw && typeof raw === 'object' && raw.description) || null,
      executionLabel: runtime === 'active'
        ? 'active'
        : runtime === 'retired'
          ? 'retired'
          : 'unsupported',
    };
  });

  const unknownKeys = presentKeys.filter((k) => !ALLOWED_REWARD_RULE_KEYS.has(k));
  return {
    currency: REWARD_RULE_CURRENCY,
    ownership: 'local',
    engagementGrantsRetired: true,
    rules: known,
    unknownKeys,
  };
}

function validateRuleValue(def, num, nextConfig) {
  if (!Number.isFinite(num) || !Number.isSafeInteger(num)) {
    throw Object.assign(new Error(`Invalid integer value for ${def.key}`), { statusCode: 400, code: 'invalid_value' });
  }
  const min = def.min ?? AMOUNT_MIN;
  const max = def.max ?? AMOUNT_MAX;
  if (num < min || num > max) {
    throw Object.assign(new Error(`${def.key} must be between ${min} and ${max}`), {
      statusCode: 400,
      code: 'out_of_bounds',
    });
  }
  if (def.key === 'reward_min_amount' || def.key === 'reward_max_amount') {
    const minRaw = def.key === 'reward_min_amount' ? num : readConfigValue(nextConfig.reward_min_amount, 0);
    const maxRaw = def.key === 'reward_max_amount' ? num : readConfigValue(nextConfig.reward_max_amount, AMOUNT_MAX);
    const tipMin = Number(minRaw);
    const tipMax = Number(maxRaw);
    if (Number.isFinite(tipMin) && Number.isFinite(tipMax) && tipMin > tipMax) {
      throw Object.assign(new Error('reward_min_amount cannot exceed reward_max_amount'), {
        statusCode: 400,
        code: 'invalid_tip_bounds',
      });
    }
  }
}

/**
 * Merge permitted numeric updates into existing config. Rejects unknown keys.
 * Preserves unknown/legacy fields not in the update set.
 * @returns {{ nextConfig: object, applied: string[] }}
 */
export function mergeRewardRuleUpdates(existingConfig, updates) {
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

  const next = { ...existingConfig };
  const applied = [];
  for (const key of keys) {
    const def = REWARD_RULE_DEFS.find((d) => d.key === key);
    const raw = updates[key];
    const num = typeof raw === 'number' ? raw : Number(raw);
    validateRuleValue(def, num, next);
    next[key] = writeConfigValue(existingConfig[key], num);
    applied.push(key);
  }
  return { nextConfig: next, applied };
}
