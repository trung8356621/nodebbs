/**
 * Display helpers for ledger transactions (Admin VND / User Credit).
 * Never invents historical VND from the current rate.
 */

import { getTransactionTypeLabel } from './transactionTypes.js';

export {
  amountToneClass,
  formatSignedCredit,
  formatSignedVnd,
  formatUnsignedCredit,
  formatUnsignedVnd,
  parseAmountNumber,
  presentAmountCell,
  presentBalanceCell,
} from './transactionValueFormat.js';

/**
 * Neutral Admin summary from type + trusted metadata. Falls back to original description.
 */
export function getTransactionSummary(row, t) {
  const type = row?.type;
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const label = getTransactionTypeLabel(type, t);

  if (type === 'pin_purchase' && meta.topicId) {
    return `${label} · #${meta.topicId}`;
  }
  if (type === 'seo_purchase' && meta.topicId) {
    return `${label} · #${meta.topicId}`;
  }
  if (type === 'check_in') {
    return meta.checkInStreak ? `${label} · ${meta.checkInStreak}` : label;
  }
  if (type === 'post_topic' || type === 'post_reply' || type === 'receive_like' || type === 'invite_user') {
    return label;
  }
  if (type === 'admin_grant' || type === 'admin_deduct' || type === 'ops_credit_grant') {
    return label;
  }
  if (type === 'pin_correction' || type === 'seo_correction') {
    return meta.reason ? `${label}: ${meta.reason}` : label;
  }

  // Unknown / fixture: prefer type label over opaque lab notes when label is mapped.
  if (label && label !== type) return label;
  return row?.description || type || '—';
}

export const TRANSACTION_TYPE_FILTER_KEYS = [
  'admin_grant',
  'admin_deduct',
  'ops_credit_grant',
  'pin_purchase',
  'pin_correction',
  'seo_purchase',
  'seo_correction',
  'check_in',
  'post_topic',
  'post_reply',
  'receive_like',
  'invite_user',
  'test_fixture',
];
