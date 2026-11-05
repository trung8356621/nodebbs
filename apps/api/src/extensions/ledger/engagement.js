export const AUTOMATIC_CREDIT_TYPES = new Set([
  'check_in',
  'post_topic',
  'post_reply',
  'receive_like',
  'invite_user',
  'register',
  'registration',
  'register_reward',
  'badge_reward',
  'achievement_reward',
]);

/** Trusted activity-rules engine marker — only server-side handlers may set this. */
export const ACTIVITY_RULES_ENGINE = 'activity-rules-v1';

/**
 * Block legacy / unsafe engagement grant paths.
 * Allows grants that are explicitly issued by the activity-rules engine.
 * Does not reopen HTTP 410 tip/check-in legacy routes.
 */
export function rejectEngagementCredit({ currencyCode, type, referenceType, metadata }) {
  if (currencyCode !== 'credits') return;
  if (metadata?.engine === ACTIVITY_RULES_ENGINE) return;
  if (
    AUTOMATIC_CREDIT_TYPES.has(type)
    || referenceType === 'reward_event'
    || metadata?.source === 'rewards-extension'
  ) {
    throw Object.assign(new Error('Commercial Credit engagement rewards are retired'), { statusCode: 410 });
  }
}
