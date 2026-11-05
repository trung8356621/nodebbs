'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { bankPaymentAdminApi } from '../../api/bankPayment';
import { formatCreditAmount, formatVnd, parseVndInput } from '../../utils/money';

const ORDER_STATUSES = [
  'all',
  'pending',
  'awaiting_funds',
  'underpaid',
  'overpaid',
  'paid',
  'granted',
  'unmatched',
  'expired',
  'cancelled',
  'failed',
  'provider_offline',
];

function unwrap(res) {
  return res?.data ?? res;
}

function StatusPill({ tone = 'muted', children }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
      : tone === 'warn'
        ? 'border-amber-600/40 text-amber-700 dark:text-amber-400'
        : tone === 'bad'
          ? 'border-destructive/40 text-destructive'
          : 'text-muted-foreground';
  return (
    <Badge variant="outline" className={`font-normal ${cls}`}>
      {children}
    </Badge>
  );
}

function formatTs(value, locale) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(locale || undefined);
  } catch {
    return '—';
  }
}

function connectionLabel(t, status) {
  const map = {
    payment_off: t('payConnPaymentOff'),
    bank_unconfigured: t('payConnBankUnconfigured'),
    webhook_unconfigured: t('payConnWebhookUnconfigured'),
    sandbox_ready: t('payConnSandboxReady'),
    grants_blocked: t('payConnGrantsBlocked'),
    ready: t('payConnReady'),
  };
  return map[status] || status || '—';
}

function orderStatusLabel(t, status) {
  const key = `payOrderStatus_${status}`;
  const v = t(key);
  return v === key || String(v).startsWith('common.') ? status : v;
}

/**
 * Admin Payment UI — /dashboard/ledger?tab=payments
 * Compact data-first panels; never shows API secrets; never enables production.
 */
export function LedgerPayments() {
  const t = usePbnTranslations();
  const [sub, setSub] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshOverview = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = unwrap(await bankPaymentAdminApi.getOverview());
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setLoadError(err?.message || t('payLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('payPaymentsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('payPaymentsIntro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overview?.sandbox ? <StatusPill tone="warn">{t('payBadgeSandbox')}</StatusPill> : null}
          {overview && !overview.enabled ? (
            <StatusPill tone="bad">{t('payBadgeOff')}</StatusPill>
          ) : null}
          {overview?.enabled && !overview.paymentOpen ? (
            <StatusPill tone="warn">{t('payBadgeNotPublic')}</StatusPill>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={refreshOverview} disabled={loading}>
            {t('payRefresh')}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <Tabs value={sub} onValueChange={setSub} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">{t('paySubOverview')}</TabsTrigger>
          <TabsTrigger value="packages">{t('paySubPackages')}</TabsTrigger>
          <TabsTrigger value="orders">{t('paySubOrders')}</TabsTrigger>
          <TabsTrigger value="config">{t('paySubConfig')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel overview={overview} loading={loading} t={t} />
        </TabsContent>
        <TabsContent value="packages">
          <PackagesPanel t={t} onChanged={refreshOverview} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersPanel t={t} />
        </TabsContent>
        <TabsContent value="config">
          <ConfigPanel overview={overview} loading={loading} t={t} onRefresh={refreshOverview} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewPanel({ overview, loading, t }) {
  if (loading && !overview) {
    return <p className="text-sm text-muted-foreground">{t('payLoading')}</p>;
  }
  if (!overview) {
    return <p className="text-sm text-muted-foreground">{t('payEmptyOverview')}</p>;
  }

  const rows = [
    [t('payFieldProvider'), String(overview.provider || '—').toUpperCase()],
    [t('payFieldMode'), overview.sandbox ? t('payModeSandbox') : t('payModeProduction')],
    [
      t('payFieldPaymentStatus'),
      overview.enabled ? t('payStatusOn') : t('payStatusOff'),
    ],
    [t('payFieldConnection'), connectionLabel(t, overview.connectionStatus)],
    [
      t('payFieldReceiveBank'),
      overview.bankConfigured ? t('payBankConfigured') : t('payBankUnconfigured'),
    ],
    [t('payFieldOrderCount'), String(overview.orderCount ?? 0)],
    [
      t('payFieldLastWebhook'),
      overview.lastWebhook?.at
        ? `${formatTs(overview.lastWebhook.at, t.locale)} (${overview.lastWebhook.status || '—'})`
        : t('payNoWebhookYet'),
    ],
  ];

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-0">
              <th className="w-48 bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground">
                {label}
              </th>
              <td className="px-3 py-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!overview.enabled ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('payOffHint')}</p>
      ) : null}
    </div>
  );
}

function PackagesPanel({ t, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [edit, setEdit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ code: '', label: '', amountVnd: '', enabled: true, displayOrder: '100' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayload(unwrap(await bankPaymentAdminApi.listPackages()));
    } catch (err) {
      setPayload(null);
      setError(err?.message || t('payLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const rate = payload?.vndPerCredit;
  const packages = payload?.packages || [];

  const openCreate = () => {
    setCreating(true);
    setDraft({ code: '', label: '', amountVnd: '', enabled: true, displayOrder: '100' });
  };

  const openEdit = (pack) => {
    setEdit(pack);
    setDraft({
      code: pack.code,
      label: pack.label,
      amountVnd: String(pack.amountVnd ?? ''),
      enabled: Boolean(pack.enabled),
      displayOrder: String(pack.displayOrder ?? 0),
    });
  };

  const save = async () => {
    const amountVnd = parseVndInput(draft.amountVnd);
    if (amountVnd == null || amountVnd <= 0) {
      toast.error(t('payInvalidVnd'));
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        if (!draft.code.trim()) {
          toast.error(t('payInvalidPackageCode'));
          return;
        }
        await bankPaymentAdminApi.createPackage({
          code: draft.code.trim(),
          label: draft.label.trim() || draft.code.trim(),
          amountVnd,
          enabled: draft.enabled,
          displayOrder: Number(draft.displayOrder) || 100,
        });
        toast.success(t('payPackageSaved'));
      } else if (edit) {
        await bankPaymentAdminApi.patchPackage(edit.code, {
          label: draft.label.trim() || edit.code,
          amountVnd,
          enabled: draft.enabled,
          displayOrder: Number(draft.displayOrder) || 0,
        });
        toast.success(t('payPackageSaved'));
      }
      setCreating(false);
      setEdit(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t('paySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (pack, enabled) => {
    try {
      await bankPaymentAdminApi.patchPackage(pack.code, { enabled });
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t('paySaveFailed'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('payPackagesHint')}
          {rate != null ? ` · 1 Credit = ${formatVnd(rate, t.locale)}` : ''}
        </p>
        <Button type="button" size="sm" onClick={openCreate}>
          {t('payPackageAdd')}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">{t('payLoading')}</p> : null}

      {!loading && packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('payPackagesEmpty')}</p>
      ) : null}

      {packages.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('payColPackage')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('payColPriceVnd')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('payColCredits')}</th>
                <th className="px-3 py-2 font-medium">{t('payColStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('payColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pack) => (
                <tr key={pack.code} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{pack.label}</div>
                    <div className="text-xs text-muted-foreground">{pack.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatVnd(pack.amountVnd, t.locale)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCreditAmount(pack.estimatedCredits, t.locale)} Credit
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(pack.enabled)}
                        onCheckedChange={(v) => toggleEnabled(pack, v)}
                        aria-label={t('payColStatus')}
                      />
                      <span className="text-xs text-muted-foreground">
                        {pack.enabled ? t('payPackageEnabled') : t('payPackageDisabled')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(pack)}>
                      {t('payEdit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={creating || Boolean(edit)} onOpenChange={(open) => {
        if (!open) {
          setCreating(false);
          setEdit(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creating ? t('payPackageAdd') : t('payPackageEdit')}</DialogTitle>
            <DialogDescription>{t('payPackageDialogHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {creating ? (
              <div className="space-y-1">
                <Label>{t('payPackageCode')}</Label>
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                  placeholder="topup_100k"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{draft.code}</p>
            )}
            <div className="space-y-1">
              <Label>{t('payColPackage')}</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('payColPriceVnd')}</Label>
              <Input
                value={draft.amountVnd}
                onChange={(e) => setDraft((d) => ({ ...d, amountVnd: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('payDisplayOrder')}</Label>
              <Input
                value={draft.displayOrder}
                onChange={(e) => setDraft((d) => ({ ...d, displayOrder: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label>{t('payPackageEnabled')}</Label>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreating(false); setEdit(null); }}>
                {t('payCancel')}
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {t('paySave')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersPanel({ t }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = unwrap(await bankPaymentAdminApi.listOrders({
        status,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 20,
      }));
      setItems(data?.items || []);
      setPagination(data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      setItems([]);
      setError(err?.message || t('payLoadError'));
    } finally {
      setLoading(false);
    }
  }, [status, from, to, t]);

  useEffect(() => {
    load(1);
  }, [load]);

  const openDetail = async (orderId) => {
    setDetailLoading(true);
    try {
      const data = unwrap(await bankPaymentAdminApi.getOrder(orderId));
      setDetail(data);
    } catch (err) {
      toast.error(err?.message || t('payLoadError'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label>{t('payFilterStatus')}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? t('payFilterAllStatuses') : orderStatusLabel(t, s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t('payFilterFrom')}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t('payFilterTo')}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={() => load(1)}>
            {t('payApplyFilters')}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">{t('payLoading')}</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('payOrdersEmpty')}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('payColOrder')}</th>
                <th className="px-3 py-2 font-medium">{t('payColUser')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('payColAmountVnd')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('payColCreditsGranted')}</th>
                <th className="px-3 py-2 font-medium">{t('payColStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('payColTime')}</th>
                <th className="px-3 py-2 font-medium">{t('payColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.orderId} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{row.paymentCode || row.orderId}</div>
                    {row.sandbox ? <StatusPill tone="warn">{t('payBadgeSandbox')}</StatusPill> : null}
                  </td>
                  <td className="px-3 py-2">{row.userDisplayName || row.username || row.userId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatVnd(row.amountVndReceived ?? row.amountVndRequested, t.locale)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.creditsGranted != null
                      ? `${formatCreditAmount(row.creditsGranted, t.locale)} Credit`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{orderStatusLabel(t, row.status)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatTs(row.createdAt, t.locale)}</td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(row.orderId)}>
                      {t('payDetails')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('payPageOf', { page: pagination.page, total: pagination.totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              {t('payPrev')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => load(pagination.page + 1)}
            >
              {t('payNext')}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(detail) || detailLoading} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('payOrderDetailTitle')}</DialogTitle>
            <DialogDescription>{t('payOrderDetailHint')}</DialogDescription>
          </DialogHeader>
          {detailLoading && !detail ? (
            <p className="text-sm text-muted-foreground">{t('payLoading')}</p>
          ) : detail ? (
            <OrderDetailBody detail={detail} t={t} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetailBody({ detail, t }) {
  const order = detail.order || {};
  const events = detail.events || [];
  const ledger = detail.ledgerReference;

  return (
    <div className="space-y-4 text-sm">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full">
          <tbody>
            {[
              [t('payColOrder'), order.paymentCode || order.orderId],
              [t('payFieldOrderId'), order.orderId],
              [t('payColUser'), order.userDisplayName || order.username || order.userId],
              [t('payColAmountVnd'), formatVnd(order.amountVndRequested, t.locale)],
              [t('payAmountReceived'), formatVnd(order.amountVndReceived, t.locale)],
              [t('payColCreditsGranted'), order.creditsGranted != null ? `${formatCreditAmount(order.creditsGranted, t.locale)} Credit` : '—'],
              [t('payRateApplied'), order.vndPerCreditApplied != null ? formatVnd(order.vndPerCreditApplied, t.locale) : '—'],
              [t('payColStatus'), orderStatusLabel(t, order.status)],
              [t('payProviderTxn'), order.providerTxnRef || '—'],
              [t('payBankTxn'), order.bankTxnRef || '—'],
              [t('payColTime'), formatTs(order.confirmedAt || order.createdAt, t.locale)],
            ].map(([k, v]) => (
              <tr key={k} className="border-b last:border-0">
                <th className="w-40 bg-muted/30 px-2 py-1.5 text-left font-medium text-muted-foreground">{k}</th>
                <td className="px-2 py-1.5 break-all">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="mb-2 font-medium">{t('payLedgerRefTitle')}</h4>
        {ledger ? (
          <p className="rounded-md border px-3 py-2 font-mono text-xs">
            {t('payLedgerRefLine', {
              id: ledger.transactionId,
              type: ledger.referenceType,
              ref: ledger.referenceId,
            })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t('payLedgerRefNone')}</p>
        )}
      </div>

      <div>
        <h4 className="mb-2 font-medium">{t('payEventsTitle')}</h4>
        {events.length === 0 ? (
          <p className="text-muted-foreground">{t('payEventsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">{t('payColTime')}</th>
                  <th className="px-2 py-1.5">{t('payColStatus')}</th>
                  <th className="px-2 py-1.5">{t('payMatchResult')}</th>
                  <th className="px-2 py-1.5 text-right">{t('payColAmountVnd')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-t">
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatTs(ev.processedAt || ev.createdAt, t.locale)}</td>
                    <td className="px-2 py-1.5">{ev.status}</td>
                    <td className="px-2 py-1.5">{ev.matchResult || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatVnd(ev.amountVnd, t.locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigPanel({ overview, loading, t, onRefresh }) {
  const cfg = overview;
  const rows = useMemo(() => {
    if (!cfg) return [];
    return [
      [t('payFieldProvider'), String(cfg.provider || '—').toUpperCase()],
      [t('payFieldMode'), cfg.sandbox ? t('payModeSandbox') : t('payModeProduction')],
      [t('payFieldFeatureFlag'), cfg.enabled ? t('payStatusOn') : t('payStatusOff')],
      [t('payFieldPublicCheckout'), cfg.publicCheckout ? t('payStatusOn') : t('payStatusOff')],
      [t('payFieldWebhookUrl'), cfg.webhookUrl || t('payWebhookUrlMissing')],
      [
        t('payFieldConfigStatus'),
        cfg.sepayConfigured ? t('payConfigComplete') : t('payConfigIncomplete'),
      ],
      [
        t('payFieldReceiveBank'),
        cfg.bankConfigured
          ? [
              cfg.receiveBank?.bankCode,
              cfg.receiveBank?.accountName,
              cfg.receiveBank?.accountNumberMasked,
            ].filter(Boolean).join(' · ')
          : t('payBankUnconfigured'),
      ],
      [
        t('payFieldLastWebhook'),
        cfg.lastWebhook?.at ? formatTs(cfg.lastWebhook.at, t.locale) : t('payNoWebhookYet'),
      ],
      [t('payFieldSecretsWebhook'), cfg.secrets?.webhookSecret ? t('paySecretPresent') : t('paySecretMissing')],
      [t('payFieldSecretsToken'), cfg.secrets?.apiToken ? t('paySecretPresent') : t('paySecretMissing')],
    ];
  }, [cfg, t]);

  if (loading && !cfg) {
    return <p className="text-sm text-muted-foreground">{t('payLoading')}</p>;
  }
  if (!cfg) {
    return <p className="text-sm text-muted-foreground">{t('payEmptyOverview')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b last:border-0">
                <th className="w-52 bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground">
                  {label}
                </th>
                <td className="px-3 py-2 break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t('payProdActivationTitle')}</p>
        <p>{t('payProdActivationDisabled')}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-2" disabled>
          {t('payEnableProduction')} — {t('payNotSupported')}
        </Button>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
        {t('payRefresh')}
      </Button>
    </div>
  );
}
