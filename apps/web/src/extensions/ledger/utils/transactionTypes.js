import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
/**
 * Transaction type mappings and utilities
 */

export const TRANSACTION_TYPES = {
  CHECK_IN: 'check_in',
  POST_TOPIC: 'post_topic',
  POST_REPLY: 'post_reply',
  RECEIVE_LIKE: 'receive_like',
  REWARD_POST: 'reward_post',
  RECEIVE_REWARD: 'receive_reward',
  BUY_AVATAR_FRAME: 'buy_avatar_frame',
  BUY_BADGE: 'buy_badge',
  BUY_ITEM: 'buy_item',
  INVITE_USER: 'invite_user',
  ADMIN_GRANT: 'admin_grant',
  ADMIN_DEDUCT: 'admin_deduct',
  GIFT_SENT: 'gift_sent',
  SHOP_PURCHASE: 'shop_purchase',
  GENERATE_INVITATION: 'generate_invitation',
  LOTTERY_FREEZE: 'lottery_freeze',
  LOTTERY_GRANT: 'lottery_grant',
  LOTTERY_REFUND: 'lottery_refund',
  ATTACHMENT_PURCHASE: 'attachment_purchase',
  ATTACHMENT_PURCHASE_REFUND: 'attachment_purchase_refund'
};
export const TRANSACTION_TYPE_LABELS = (pbnT = pbnRuntimeT) => ({
  [TRANSACTION_TYPES.CHECK_IN]: pbnT("m1710"),
  [TRANSACTION_TYPES.POST_TOPIC]: pbnT("m54"),
  [TRANSACTION_TYPES.POST_REPLY]: pbnT("m1899"),
  [TRANSACTION_TYPES.RECEIVE_LIKE]: pbnT("m1900"),
  [TRANSACTION_TYPES.REWARD_POST]: pbnT("m1871"),
  [TRANSACTION_TYPES.RECEIVE_REWARD]: pbnT("m1870"),
  [TRANSACTION_TYPES.BUY_AVATAR_FRAME]: pbnT("m1901"),
  [TRANSACTION_TYPES.BUY_BADGE]: pbnT("m1902"),
  [TRANSACTION_TYPES.BUY_ITEM]: pbnT("m1903"),
  [TRANSACTION_TYPES.INVITE_USER]: pbnT("m294"),
  [TRANSACTION_TYPES.ADMIN_GRANT]: pbnT("m1904"),
  [TRANSACTION_TYPES.ADMIN_DEDUCT]: pbnT("m1905"),
  [TRANSACTION_TYPES.GIFT_SENT]: pbnT("m1906"),
  [TRANSACTION_TYPES.SHOP_PURCHASE]: pbnT("m1903"),
  [TRANSACTION_TYPES.GENERATE_INVITATION]: pbnT("m308"),
  [TRANSACTION_TYPES.LOTTERY_FREEZE]: pbnT("m1907"),
  [TRANSACTION_TYPES.LOTTERY_GRANT]: pbnT("m1908"),
  [TRANSACTION_TYPES.LOTTERY_REFUND]: pbnT("m1909"),
  [TRANSACTION_TYPES.ATTACHMENT_PURCHASE]: pbnT("m1879"),
  [TRANSACTION_TYPES.ATTACHMENT_PURCHASE_REFUND]: pbnT("m1880")
});
export const TRANSACTION_TYPE_COLORS = {
  [TRANSACTION_TYPES.CHECK_IN]: 'default',
  [TRANSACTION_TYPES.POST_TOPIC]: 'default',
  [TRANSACTION_TYPES.POST_REPLY]: 'default',
  [TRANSACTION_TYPES.RECEIVE_LIKE]: 'default',
  [TRANSACTION_TYPES.REWARD_POST]: 'destructive',
  [TRANSACTION_TYPES.RECEIVE_REWARD]: 'default',
  [TRANSACTION_TYPES.BUY_AVATAR_FRAME]: 'destructive',
  [TRANSACTION_TYPES.BUY_BADGE]: 'destructive',
  [TRANSACTION_TYPES.BUY_ITEM]: 'destructive',
  [TRANSACTION_TYPES.INVITE_USER]: 'default',
  [TRANSACTION_TYPES.ADMIN_GRANT]: 'default',
  [TRANSACTION_TYPES.ADMIN_DEDUCT]: 'destructive',
  [TRANSACTION_TYPES.GIFT_SENT]: 'destructive',
  [TRANSACTION_TYPES.SHOP_PURCHASE]: 'destructive',
  [TRANSACTION_TYPES.GENERATE_INVITATION]: 'destructive',
  [TRANSACTION_TYPES.LOTTERY_FREEZE]: 'destructive',
  [TRANSACTION_TYPES.LOTTERY_GRANT]: 'default',
  [TRANSACTION_TYPES.LOTTERY_REFUND]: 'default',
  [TRANSACTION_TYPES.ATTACHMENT_PURCHASE]: 'destructive',
  [TRANSACTION_TYPES.ATTACHMENT_PURCHASE_REFUND]: 'default'
};

/**
 * Get the label for a transaction type
 * @param {string} type - Transaction type key
 * @returns {string} Human-readable label
 */
export function getTransactionTypeLabel(type, pbnT = pbnRuntimeT) {
  return TRANSACTION_TYPE_LABELS(pbnT)[type] || type;
}

/**
 * Get the badge color variant for a transaction type
 * @param {string} type - Transaction type key
 * @returns {string} Badge variant
 */
export function getTransactionTypeColor(type) {
  return TRANSACTION_TYPE_COLORS[type] || 'default';
}

/**
 * Check if a transaction type is a debit (negative amount)
 * @param {string} type - Transaction type key
 * @returns {boolean}
 */
export function isDebitTransaction(type) {
  return TRANSACTION_TYPE_COLORS[type] === 'destructive';
}
