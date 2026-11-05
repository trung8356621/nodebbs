'use client';

import { usePbnTranslations } from '@/i18n/useTranslations';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/common/DataTable';
import { FormDialog } from '@/components/common/FormDialog';
import { CurrencyOperationDialog } from './CurrencyOperationDialog';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { ledgerApi } from '../../api';
import { DEFAULT_CURRENCY_CODE } from '../../constants';
import { toast } from 'sonner';
import Link from '@/components/common/Link';

export function LedgerCurrencies() {
  const pbnT = usePbnTranslations();
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationMode, setOperationMode] = useState('grant');
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
    isActive: true,
  });

  const fetchCurrencies = async () => {
    try {
      const data = await ledgerApi.getCurrencies();
      setCurrencies(data);
    } catch {
      toast.error(pbnT('m1839'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const handleCreateClick = () => {
    setEditingCurrency(null);
    setFormData({ code: '', name: '', symbol: '', isActive: true });
    setIsDialogOpen(true);
  };

  const handleEditClick = (currency) => {
    setEditingCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isActive: currency.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSaveCurrency = async () => {
    setSubmitting(true);
    // Identity only — never send config so server preserves reward rules.
    const data = {
      code: formData.code,
      name: formData.name,
      symbol: formData.symbol,
      isActive: formData.isActive,
    };
    try {
      await ledgerApi.upsertCurrency(data);
      toast.success(pbnT('m1840'));
      setIsDialogOpen(false);
      fetchCurrencies();
    } catch (err) {
      console.error(err);
      toast.error(pbnT('m1841'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOperationSubmit = async (data) => {
    setSubmitting(true);
    try {
      await ledgerApi.admin.operation(data);
      toast.success(data.type === 'grant' ? pbnT('m1842') : pbnT('m1843'));
      setOperationOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || pbnT('m568'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {pbnT('ledgerCurrencyIdentityHint')}{' '}
        <Link href="/dashboard/ledger?tab=services" className="underline">
          {pbnT('ledgerTabServices')}
        </Link>
        {' → '}
        {pbnT('ledgerRewardRulesTitle')}
      </p>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={() => {
            setOperationMode('grant');
            setOperationOpen(true);
          }}
        >
          <ArrowUpCircle className="h-4 w-4" />
          {pbnT('m1844')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOperationMode('deduct');
            setOperationOpen(true);
          }}
        >
          <ArrowDownCircle className="h-4 w-4" />
          {pbnT('m1845')}
        </Button>
        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4" />
          {pbnT('m1846')}
        </Button>
      </div>

      <CurrencyOperationDialog
        open={operationOpen}
        onOpenChange={setOperationOpen}
        onSubmit={handleOperationSubmit}
        submitting={submitting}
        mode={operationMode}
        currencies={currencies}
      />
      <DataTable
        columns={[
          { key: 'name', label: pbnT('m230') },
          {
            key: 'code',
            label: pbnT('m1847'),
            render: (val) => (
              <span className="font-mono">
                {val}
                {val === DEFAULT_CURRENCY_CODE && (
                  <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {pbnT('m534')}
                  </span>
                )}
              </span>
            ),
          },
          { key: 'symbol', label: pbnT('m1848') },
          {
            key: 'isActive',
            label: pbnT('m298'),
            render: (isActive) =>
              isActive ? (
                <span className="text-green-600">{pbnT('m566')}</span>
              ) : (
                <span className="text-muted-foreground">{pbnT('m292')}</span>
              ),
          },
          {
            key: 'actions',
            label: pbnT('m234'),
            align: 'right',
            render: (_, currency) => (
              <Button variant="ghost" size="sm" onClick={() => handleEditClick(currency)}>
                {pbnT('m235')}
              </Button>
            ),
          },
        ]}
        data={currencies}
        loading={loading}
      />

      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingCurrency ? pbnT('m1849') : pbnT('m1846')}
        description={
          editingCurrency
            ? pbnT('m1850', { arg0: editingCurrency.name, arg1: editingCurrency.code })
            : pbnT('m1851')
        }
        onSubmit={handleSaveCurrency}
        loading={submitting}
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="code">{pbnT('m1852')}</Label>
            <Input
              id="code"
              name="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              disabled={!!editingCurrency}
              placeholder={pbnT('m1853')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">{pbnT('m230')}</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder={pbnT('m1854')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="symbol">{pbnT('m1848')}</Label>
            <Input
              id="symbol"
              name="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              required
              placeholder={pbnT('m1855')}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">{pbnT('m1718')}</Label>
            <Switch
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
