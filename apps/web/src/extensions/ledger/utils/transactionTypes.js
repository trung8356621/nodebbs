import { runtimeTranslate as pbnRuntimeT } from '@/i18n/translate';

/**
 * Transaction type registry — DB/API codes stay English; UI labels via i18n.
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
  ATTACHMENT_PURCHASE_REFUND: 'attachment_purchase_refund',
  SEO_PURCHASE: 'seo_purchase',
  SEO_CORRECTION: 'seo_correction',
  PIN_PURCHASE: 'pin_purchase',
  PIN_CORRECTION: 'pin_correction',
  OPS_CREDIT_GRANT: 'ops_credit_grant',
  TEST_FIXTURE: 'test_fixture',
};

export function getTransactionTypeLabel(type, pbnT = pbnRuntimeT) {
  if (!type) return '—';
  const key = `ledgerTxType_${type}`;
  try {
    const labeled = pbnT(key);
    if (labeled && labeled !== key && !String(labeled).startsWith('common.')) return labeled;
  } catch { /* fall through */ }
  // Legacy m-keys for a few common types
  const legacy = {
    check_in: 'm1710',
    post_topic: 'm54',
    post_reply: 'm1899',
    receive_like: 'm1900',
    admin_grant: 'm1904',
    admin_deduct: 'm1905',
    ops_credit_grant: 'txOpsCreditGrant',
    pin_purchase: 'pinTitle',
    seo_purchase: 'seoTitle',
  };
  if (legacy[type]) {
    try {
      const v = pbnT(legacy[type]);
      if (v && v !== legacy[type]) return v;
    } catch { /* ignore */ }
  }
  return type;
}

export function getTransactionTypeColor(type) {
  const debit = new Set([
    'reward_post', 'buy_avatar_frame', 'buy_badge', 'buy_item', 'admin_deduct',
    'gift_sent', 'shop_purchase', 'generate_invitation', 'lottery_freeze',
    'attachment_purchase', 'seo_purchase', 'pin_purchase', 'post_reply',
  ]);
  return debit.has(type) ? 'destructive' : 'default';
}

export function isDebitTransaction(type) {
  return getTransactionTypeColor(type) === 'destructive';
}
