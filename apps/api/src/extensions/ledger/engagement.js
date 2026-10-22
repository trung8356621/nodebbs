export const AUTOMATIC_CREDIT_TYPES=new Set(['check_in','post_topic','post_reply','receive_like','invite_user','register','registration','register_reward','badge_reward','achievement_reward']);
export function rejectEngagementCredit({currencyCode,type,referenceType,metadata}) {
  if(currencyCode==='credits'&&(AUTOMATIC_CREDIT_TYPES.has(type)||referenceType==='reward_event'||metadata?.source==='rewards-extension'))throw Object.assign(new Error('Commercial Credit engagement rewards are retired'),{statusCode:410});
}
