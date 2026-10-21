'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { rewardsApi, ledgerApi } from '@/lib/api';
import { Coins, Loader2, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useDefaultCurrencyName, DEFAULT_CURRENCY_CODE } from '@/extensions/ledger/contexts/LedgerContext';
const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];
import { RewardSuccessDialog } from './RewardSuccessDialog';
export function RewardDialog({
  open,
  onOpenChange,
  postId,
  postAuthor,
  onSuccess,
  onViewHistory
}) {
  const pbnT = usePbnTranslations();
  const currencyName = useDefaultCurrencyName();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [minAmount, setMinAmount] = useState(1);
  const [maxAmount, setMaxAmount] = useState(1000);

  // Success Dialog State
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  useEffect(() => {
    if (open) {
      // 获取用户余额
      fetchBalance();
      // 获取配置（可选：如果后端提供）
      setShowSuccess(false); // Reset success state on open
    }
  }, [open]);

  // ... (fetchBalance implementation remains the same)
  const fetchBalance = async () => {
    try {
      // 获取账户列表，包含配置信息
      const accounts = await ledgerApi.getAccounts();
      const creditsAccount = accounts.find(a => a.currency.code === DEFAULT_CURRENCY_CODE);
      if (creditsAccount) {
        setBalance(creditsAccount.balance);

        // 解析配置
        if (creditsAccount.currency.config) {
          try {
            const config = typeof creditsAccount.currency.config === 'string' ? JSON.parse(creditsAccount.currency.config) : creditsAccount.currency.config;
            if (config.reward_min_amount?.value) {
              setMinAmount(Number(config.reward_min_amount.value));
            }
            if (config.reward_max_amount?.value) {
              setMaxAmount(Number(config.reward_max_amount.value));
            }
          } catch (e) {
            console.error("Could not parse currency configuration:", e);
          }
        }
      }
    } catch (error) {
      console.error("Could not load account information:", error);
    }
  };
  const handleQuickSelect = value => {
    setAmount(String(value));
  };
  const handleSubmit = async () => {
    const rewardAmount = parseInt(amount);
    if (!rewardAmount || isNaN(rewardAmount)) {
      toast.error(pbnT("m1915"));
      return;
    }
    if (rewardAmount < minAmount) {
      toast.error(pbnT("m1916", {
        arg0: minAmount
      }));
      return;
    }
    if (rewardAmount > maxAmount) {
      toast.error(pbnT("m1917", {
        arg0: maxAmount
      }));
      return;
    }
    if (balance !== null && rewardAmount > balance) {
      toast.error(pbnT("m1918", {
        arg0: currencyName
      }));
      return;
    }
    setIsSubmitting(true);
    try {
      await rewardsApi.reward(postId, rewardAmount, message || undefined);
      // toast.success(`成功打赏 ${rewardAmount} 积分！`); // Removed toast in favor of dialog

      // 本地更新余额（减去打赏金额），无需重新调用接口
      if (balance !== null) {
        setBalance(balance - rewardAmount);
      }

      // 调用成功回调，传递打赏金额用于局部更新
      if (onSuccess) {
        onSuccess(rewardAmount);
      }

      // 重置表单
      setAmount('');
      setMessage('');

      // Show Success Dialog instead of closing immediately
      setSuccessAmount(rewardAmount);
      setShowSuccess(true);
    } catch (error) {
      toast.error(error.message || pbnT("m1919"));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCancel = () => {
    setAmount('');
    setMessage('');
    onOpenChange(false);
  };
  const handleSuccessClose = () => {
    setShowSuccess(false);
    onOpenChange(false);
  };
  return <>
        {/* Input Dialog - hidden when success shown to avoid unmounting issues if we want transitions, 
            but for now simply conditionally rendering is fine if we return null for FormDialog when success is true?
            Actually, let's keep it simple: Render FormDialog only if !showSuccess. 
            However, we need `open` to be true for standard Dialogs. 
         */}
        {!showSuccess && <FormDialog open={open} onOpenChange={onOpenChange} maxWidth="sm:max-w-[425px]" title={<div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />{pbnT("m1920")}{" "}{postAuthor}
                    </div>
                    {onViewHistory && <Button variant="link" size="sm" className="text-xs text-muted-foreground h-auto p-0 mr-10" onClick={onViewHistory}>{pbnT("m1921")}</Button>}
                </div>} description={pbnT("m1922")} footer={<DialogFooter className="shrink-0 p-6 pt-4">
                  <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>{pbnT("m486")}</Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting || !amount}>
                    {isSubmitting ? <>
                        <Loader2 className="h-4 w-4 animate-spin" />{pbnT("m1923")}</> : <>
                        <Heart className="h-4 w-4" />{pbnT("m1924")}</>}
                  </Button>
                </DialogFooter>}>
                <div className="space-y-4 py-4">
                  {/* 余额显示 */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{pbnT("m1883")}</span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Coins className="h-4 w-4" />
                      {balance !== null ? balance : '-'}
                    </span>
                  </div>

                  {/* 快速选择金额 */}
                  <div>
                    <Label>{pbnT("m1925")}</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {QUICK_AMOUNTS.map(value => <Button key={value} type="button" variant={amount === String(value) ? 'default' : 'outline'} size="sm" onClick={() => handleQuickSelect(value)} disabled={balance !== null && value > balance}>
                          <Coins className="h-3 w-3 mr-1" />
                          {value}
                        </Button>)}
                    </div>
                  </div>

                  {/* 自定义金额 */}
                  <div>
                    <Label htmlFor="amount">{pbnT("m1926")}</Label>
                    <Input id="amount" type="number" placeholder={pbnT("m1927", {
            arg0: minAmount,
            arg1: maxAmount
          })} value={amount} onChange={e => setAmount(e.target.value)} min={minAmount} max={maxAmount} className="mt-2" />
                  </div>

                  {/* 打赏留言 */}
                  <div>
                    <Label htmlFor="message">{pbnT("m1928")}</Label>
                    <Textarea id="message" placeholder={pbnT("m1929")} value={message} onChange={e => setMessage(e.target.value)} maxLength={200} rows={3} className="mt-2" />
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      {message.length}/200
                    </div>
                  </div>
                </div>
            </FormDialog>}
        
        {/* Success Dialog */}
        <RewardSuccessDialog open={open && showSuccess} onOpenChange={v => !v && handleSuccessClose()} amount={successAmount} />
    </>;
}
