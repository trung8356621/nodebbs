import { usePbnTranslations } from "@/i18n/useTranslations";
import { Badge } from '@/components/ui/badge';
import { getTransactionTypeLabel, getTransactionTypeColor } from '../../utils/transactionTypes';

/**
 * Display transaction type badge
 * @param {Object} props
 * @param {string} props.type - Transaction type key
 */
export function TransactionTypeBadge({
  type,
  amount,
  meta
}) {
  const pbnT = usePbnTranslations();
  let label = getTransactionTypeLabel(type, pbnT);
  let variant = getTransactionTypeColor(type);

  if(type==='pin_purchase')label=pbnT('pinTitle');
  if(type==='pin_correction')label=pbnT('pinCorrect');
  // 特殊处理：打赏帖子 (Reward Post)
  if (type === 'reward_post') {
    const isTopic = meta?.isTopic;
    if (amount > 0) {
      // 收入：收到打赏
      label = isTopic ? pbnT("m1866") : pbnT("m1867");
      variant = getTransactionTypeColor('receive_reward') || 'default';
    } else {
      // 支出：打赏他人
      label = isTopic ? pbnT("m1868") : pbnT("m1869");
      // keep default destructive variant
    }
  }

  // 附件购买与打赏同理：ledger.transfer 给转出/转入两侧写的是同一个 type，
  // 收支只能按金额正负区分（表里登记的是购买者视角）
  if (type === 'attachment_purchase') {
    label = amount > 0 ? pbnT("m1878") : pbnT("m1879");
    variant = amount > 0 ? 'default' : 'destructive';
  } else if (type === 'attachment_purchase_refund') {
    label = amount > 0 ? pbnT("m1880") : pbnT("m1881");
    variant = amount > 0 ? 'default' : 'destructive';
  }
  return <Badge variant={variant} className="text-sm border-0">
      {label}
    </Badge>;
}
