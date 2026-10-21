import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Minus } from 'lucide-react';
import { SearchSelect } from '@/components/common/SearchSelect';
import { FormDialog } from '@/components/common/FormDialog';
import { userApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * 用于管理员发放或扣除货币的操作对话框
 * @param {Object} props
 * @param {boolean} props.open - 对话框打开状态
 * @param {Function} props.onOpenChange - 打开状态改变时的回调
 * @param {Function} props.onSubmit - 表单提交时的回调 (data)
 * @param {boolean} props.submitting - 提交进行中
 * @param {'grant' | 'deduct'} props.mode - 操作模式
 * @param {Array} props.currencies - 货币列表
 */
export function CurrencyOperationDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  mode = 'grant',
  currencies = []
}) {
  const pbnT = usePbnTranslations();
  const [formData, setFormData] = useState({
    user: null,
    amount: '',
    currency: '',
    description: ''
  });
  const isGrant = mode === 'grant';
  const config = {
    grant: {
      title: pbnT("m1813"),
      description: pbnT("m1814"),
      amountLabel: pbnT("m1815"),
      amountPlaceholder: pbnT("m1816"),
      reasonLabel: pbnT("m1817"),
      reasonPlaceholder: pbnT("m1818"),
      buttonText: pbnT("m1819"),
      icon: Plus,
      buttonVariant: 'default',
      showWarning: false
    },
    deduct: {
      title: pbnT("m1820"),
      description: pbnT("m1821"),
      amountLabel: pbnT("m1815"),
      amountPlaceholder: pbnT("m1822"),
      reasonLabel: pbnT("m1817"),
      reasonPlaceholder: pbnT("m1823"),
      buttonText: pbnT("m1824"),
      icon: Minus,
      buttonVariant: 'destructive',
      showWarning: true
    }
  };
  const currentConfig = config[mode];

  // 解析 amount 字符串为数字
  const amountNumber = formData.amount === '' ? 0 : parseFloat(formData.amount);
  const isAmountValid = formData.amount !== '' && !isNaN(amountNumber) && amountNumber > 0;
  const handleSubmit = () => {
    if (!formData.user || !formData.currency || !isAmountValid) {
      return;
    }
    onSubmit({
      userId: formData.user.id,
      currency: formData.currency,
      amount: amountNumber,
      description: formData.description,
      type: mode
    });
  };
  const handleClose = () => {
    setFormData({
      user: null,
      amount: '',
      currency: '',
      description: ''
    });
    onOpenChange(false);
  };
  return <FormDialog open={open} onOpenChange={handleClose} title={currentConfig.title} description={currentConfig.description} submitText={currentConfig.buttonText} loading={submitting} onSubmit={handleSubmit} disabled={!formData.user || !formData.currency || !isAmountValid} submitClassName={currentConfig.buttonVariant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}>
            <div className="space-y-4">
                <SearchSelect value={formData.user} onChange={user => setFormData(prev => ({
        ...prev,
        user
      }))} searchFn={async query => {
        const data = await userApi.getList({
          search: query,
          limit: 10
        });
        return data.items || [];
      }} transformData={user => ({
        id: user.id,
        label: user.name || user.username,
        description: user.username
      })} label={pbnT("m1670")} placeholder={pbnT("m1671")} />

                <div className="space-y-2">
                    <Label htmlFor="currency">{pbnT("m1825")}</Label>
                    <Select value={formData.currency} onValueChange={val => setFormData(prev => ({
          ...prev,
          currency: val
        }))}>
                        <SelectTrigger>
                            <SelectValue placeholder={pbnT("m1825")} />
                        </SelectTrigger>
                        <SelectContent>
                            {currencies.map(c => <SelectItem key={c.code} value={c.code}>
                                    {c.name} ({c.code})
                                </SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>


                <div className="space-y-2">
                    <Label htmlFor="amount">{currentConfig.amountLabel}</Label>
                    <Input id="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={e => setFormData(prev => ({
          ...prev,
          amount: e.target.value
        }))} placeholder={currentConfig.amountPlaceholder} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">{currentConfig.reasonLabel}</Label>
                    <Textarea id="description" value={formData.description} onChange={e => setFormData(prev => ({
          ...prev,
          description: e.target.value
        }))} placeholder={currentConfig.reasonPlaceholder} rows={3} />
                </div>

                {currentConfig.showWarning && <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
                        <p className="text-sm text-yellow-600">{pbnT("m1826")}</p>
                    </div>}
            </div>
        </FormDialog>;
}
