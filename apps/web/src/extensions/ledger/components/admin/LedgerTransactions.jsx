'use client';

import { useEffect, useState } from 'react';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchSelect } from '@/components/common/SearchSelect';
import Time from '@/components/common/Time';
import { ledgerApi } from '../../api';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatVnd } from '../../utils/money';
import { getTransactionTypeLabel } from '../../utils/transactionTypes';
import {
  TRANSACTION_TYPE_FILTER_KEYS,
  amountToneClass,
  formatSignedCredit,
  formatUnsignedCredit,
  getTransactionSummary,
  presentAmountCell,
  presentBalanceCell,
} from '../../utils/transactionDisplay';

export function LedgerTransactions() {
  const t = usePbnTranslations();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [detail, setDetail] = useState(null);

  const [filterUser, setFilterUser] = useState(null);
  const [filterCurrency, setFilterCurrency] = useState('credits');
  const [filterType, setFilterType] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    ledgerApi.getCurrencies().then(setCurrencies).catch(() => {});
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filterCurrency && filterCurrency !== 'all') params.currency = filterCurrency;
      if (filterUser?.id) params.userId = filterUser.id;
      if (filterType !== 'all') params.type = filterType;
      if (filterDirection !== 'all') params.direction = filterDirection;
      if (filterFrom) params.from = new Date(filterFrom).toISOString();
      if (filterTo) {
        const end = new Date(filterTo);
        end.setHours(23, 59, 59, 999);
        params.to = end.toISOString();
      }
      const data = await ledgerApi.getTransactions(params);
      setTransactions(data.items || []);
      setPagination((prev) => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error(error);
      toast.error(t('m1860'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filterCurrency, filterUser, filterType, filterDirection, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('ledgerTxHistoryTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('ledgerTxHistoryIntro')}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="w-full sm:w-64">
          <SearchSelect
            value={filterUser}
            onChange={(v) => { setFilterUser(v); setPagination((p) => ({ ...p, page: 1 })); }}
            searchFn={async (query) => {
              const data = await userApi.getList({ search: query, limit: 10 });
              return data.items || [];
            }}
            transformData={(user) => ({
              id: user.id,
              label: user.name || user.username,
              description: user.username,
            })}
            label={t('m1670')}
            placeholder={t('m1671')}
          />
        </div>
        <div className="w-full sm:w-44 space-y-1">
          <Label>{t('ledgerTxFilterType')}</Label>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPagination((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('ledgerTxFilterAllTypes')}</SelectItem>
              {TRANSACTION_TYPE_FILTER_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{getTransactionTypeLabel(key, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40 space-y-1">
          <Label>{t('ledgerTxFilterDirection')}</Label>
          <Select value={filterDirection} onValueChange={(v) => { setFilterDirection(v); setPagination((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('ledgerTxFilterAllDirections')}</SelectItem>
              <SelectItem value="credit">{t('ledgerTxFilterCredit')}</SelectItem>
              <SelectItem value="debit">{t('ledgerTxFilterDebit')}</SelectItem>
              <SelectItem value="zero">{t('ledgerTxFilterZero')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40 space-y-1">
          <Label>{t('m1861')}</Label>
          <Select value={filterCurrency} onValueChange={(v) => { setFilterCurrency(v); setPagination((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('m1862')}</SelectItem>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name || c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-40 space-y-1">
          <Label>{t('ledgerTxFilterFrom')}</Label>
          <Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} />
        </div>
        <div className="w-full sm:w-40 space-y-1">
          <Label>{t('ledgerTxFilterTo')}</Label>
          <Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-3 font-medium">ID</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerTxColTime')}</th>
              <th className="p-3 font-medium">{t('ledgerTxColUser')}</th>
              <th className="p-3 font-medium">{t('ledgerTxColType')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerTxColAmount')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerTxColBalance')}</th>
              <th className="p-3 font-medium">{t('ledgerTxColSummary')}</th>
              <th className="p-3 font-medium text-right">{t('ledgerSvcColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-muted-foreground">{t('ledgerServicesLoading')}</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-muted-foreground">{t('m1875')}</td></tr>
            ) : transactions.map((row) => {
              const amount = presentAmountCell(row, t.locale);
              const bal = presentBalanceCell(row, t.locale);
              return (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="p-3 text-muted-foreground">#{row.id}</td>
                  <td className="p-3 whitespace-nowrap"><Time date={row.createdAt} /></td>
                  <td className="p-3">
                    {row.username ? (
                      <a href={`/users/${row.username}`} className="text-primary hover:underline" target="_blank" rel="noreferrer">{row.username}</a>
                    ) : '—'}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{getTransactionTypeLabel(row.type, t)}</div>
                  </td>
                  <td className={`p-3 font-semibold whitespace-nowrap ${amountToneClass(amount.tone)}`}>
                    {amount.primary ?? t('ledgerTxMissingVnd')}
                    {amount.legacy ? (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        <LegacyBadge label={t('ledgerTxLegacyBadge')} tooltip={t('ledgerTxLegacyTooltip')} />
                        {amount.missingVnd ? (
                          <span className="text-xs font-normal text-muted-foreground">{t('ledgerTxMissingVnd')}</span>
                        ) : null}
                      </div>
                    ) : amount.secondary ? (
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">{amount.secondary}</div>
                    ) : null}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {bal.primary ?? t('ledgerTxMissingVnd')}
                    {bal.secondary ? (
                      <div className="text-xs text-muted-foreground mt-0.5">{bal.secondary}</div>
                    ) : null}
                  </td>
                  <td className="p-3 max-w-xs">
                    <span className="line-clamp-2">{getTransactionSummary(row, t)}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(row)}>{t('ledgerTxActionDetail')}</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t('ledgerTxPageStatus', { page: pagination.page, total: pagination.total })}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            {t('seoPrevious')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page >= totalPages || loading}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            {t('seoNext')}
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('ledgerTxDetailTitle')} #{detail?.id}</DialogTitle>
            <DialogDescription>{t('ledgerTxDetailIntro')}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="grid gap-2 text-sm">
              <DetailRow label={t('ledgerTxColUser')} value={detail.username || detail.userId} />
              <DetailRow label={t('ledgerTxColType')} value={getTransactionTypeLabel(detail.type, t)} />
              <DetailRow label="type" value={<code className="text-xs">{detail.type}</code>} />
              <DetailRow label={t('ledgerTxColTime')} value={detail.createdAt ? new Date(detail.createdAt).toLocaleString(t.locale) : '—'} />
              <DetailRow
                label={t('ledgerTxColAmount')}
                value={(() => {
                  const cell = presentAmountCell(detail, t.locale);
                  return cell.primary ?? t('ledgerTxMissingVnd');
                })()}
              />
              <DetailRow
                label={t('ledgerTxDetailCredit')}
                value={formatSignedCredit(detail.amountCredit, t.locale).text}
              />
              <DetailRow
                label={t('ledgerTxDetailRate')}
                value={detail.snapshotCreditVnd
                  ? `1 Credit = ${formatVnd(detail.snapshotCreditVnd, t.locale)}`
                  : t('ledgerTxMissingVnd')}
              />
              <DetailRow
                label={t('ledgerTxDetailBalanceBefore')}
                value={detail.balanceBeforeVnd != null
                  ? formatVnd(detail.balanceBeforeVnd, t.locale).replace(/\s*₫\s*$/, ' đ')
                  : (detail.balanceBeforeCredit != null
                    ? formatUnsignedCredit(detail.balanceBeforeCredit, t.locale)
                    : t('ledgerTxMissingVnd'))}
              />
              <DetailRow
                label={t('ledgerTxColBalance')}
                value={(() => {
                  const cell = presentBalanceCell(detail, t.locale);
                  return cell.primary ?? t('ledgerTxMissingVnd');
                })()}
              />
              <DetailRow label={t('ledgerTxDetailRef')} value={detail.referenceType && detail.referenceId ? `${detail.referenceType}:${detail.referenceId}` : '—'} />
              <DetailRow label={t('ledgerTxDetailEngine')} value={detail.metadata?.engine || detail.metadata?.source || '—'} />
              <DetailRow label={t('ledgerTxDetailService')} value={detail.metadata?.serviceCode || detail.metadata?.productId || detail.metadata?.skuCode || '—'} />
              <DetailRow label={t('ledgerTxDetailIdempotency')} value={detail.metadata?.idempotencyKey || '—'} />
              <DetailRow label={t('ledgerTxDetailRawDesc')} value={detail.description || '—'} />
              <DetailRow label={t('ledgerTxColSummary')} value={getTransactionSummary(detail, t)} />
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right break-all">{value}</dd>
    </div>
  );
}

function LegacyBadge({ label, tooltip }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="w-fit text-xs font-normal cursor-help">
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
