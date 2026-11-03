'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Cable, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { usePermission } from '@/hooks/usePermission';
import api from '@/lib/api';

function fmt(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

export default function OpsConnectionPage() {
  const t = usePbnTranslations();
  const { hasPermission } = usePermission();
  const [status, setStatus] = useState(null);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [busy, setBusy] = useState(false);
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [opsBaseUrl, setOpsBaseUrl] = useState('https://ops.seo-ops.duckdns.org');
  const [connectionUrl, setConnectionUrl] = useState('');
  const [freeUserId, setFreeUserId] = useState('');
  const [freeCredits, setFreeCredits] = useState('10');
  const [rotationId, setRotationId] = useState('');
  const [rotationCredential, setRotationCredential] = useState('');

  const allowed = hasPermission('dashboard.extensions');

  const load = async () => {
    const [st, ord, del, led] = await Promise.all([
      api.get('/ops/forum/status'),
      api.get('/ops/forum/credit-orders'),
      api.get('/ops/forum/deliveries'),
      api.get('/ops/forum/ledger-sync'),
    ]);
    setStatus(st.data || st);
    setOrders(ord.data || []);
    setDeliveries(del.data || []);
    setLedger(led.data || null);
    if ((st.data || st)?.opsBaseUrl) setOpsBaseUrl((st.data || st).opsBaseUrl);
    if ((st.data || st)?.connectionUrl) setConnectionUrl((st.data || st).connectionUrl || '');
  };

  useEffect(() => {
    if (!allowed) return;
    load().catch((err) => toast.error(err.message || t('opsError')));
  }, [allowed]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success('OK');
    } catch (err) {
      toast.error(err.message || t('opsError'));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return <div className="p-6 text-sm text-muted-foreground">Forbidden</div>;
  }

  const s = status || {};
  const statusLabel = s.connectionStatus === 'connected'
    ? t('opsConnected')
    : s.connectionStatus === 'error'
      ? t('opsError')
      : s.hasCredential
        ? t('opsPending')
        : t('opsNotConnected');

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-8">
      <PageHeader
        title={t('opsConnection')}
        description={t('opsConnectionDesc')}
        actions={(
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(load)}>
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        )}
      />

      <section className="space-y-3 border rounded-lg p-4">
        <h2 className="font-semibold flex items-center gap-2"><Cable className="size-4" />{t('opsStatus')}</h2>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">{t('opsStatus')}</dt><dd className="font-medium">{statusLabel} ({s.connectionStatus || '—'})</dd></div>
          <div><dt className="text-muted-foreground">{t('opsForumId')}</dt><dd className="font-mono break-all">{s.forumId || '—'}</dd></div>
          <div><dt className="text-muted-foreground">{t('opsInstallationId')}</dt><dd className="font-mono break-all">{s.installationId || '—'}</dd></div>
          <div><dt className="text-muted-foreground">{t('opsBaseUrl')}</dt><dd className="font-mono break-all">{s.opsBaseUrl || '—'}</dd></div>
          <div><dt className="text-muted-foreground">{t('opsCredentialVersion')}</dt><dd>{s.credentialVersion ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">{t('opsLastVerified')}</dt><dd>{fmt(s.lastVerifiedAt)}</dd></div>
          <div><dt className="text-muted-foreground">{t('opsLastSync')}</dt><dd>{fmt(s.lastSyncAt)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">{t('opsLastError')}</dt><dd className="text-destructive break-all">{s.lastError || '—'}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={busy || !s.hasCredential} onClick={() => run(() => api.post('/ops/forum/verify'))}>
            <ShieldCheck className="size-4 mr-2" />{t('opsVerify')}
          </Button>
          <Button variant="secondary" disabled={busy || !s.hasCredential} onClick={() => run(() => api.post('/ops/forum/ledger-sync/retry', { limit: 50 }))}>
            {t('opsRetrySync')}
          </Button>
        </div>
      </section>

      {!s.hasCredential && (
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold">{t('opsConnect')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="enroll-token">{t('opsEnrollmentToken')}</Label>
              <Input id="enroll-token" type="password" autoComplete="off" value={enrollmentToken} onChange={(e) => setEnrollmentToken(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ops-url">{t('opsBaseUrl')}</Label>
              <Input id="ops-url" value={opsBaseUrl} onChange={(e) => setOpsBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-url">{t('opsConnectionUrl')}</Label>
              <Input id="cb-url" placeholder="https://forum.example.com" value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} />
            </div>
          </div>
          <Button
            disabled={busy || !enrollmentToken.trim()}
            onClick={() => run(async () => {
              await api.post('/ops/forum/enroll', {
                enrollmentToken: enrollmentToken.trim(),
                opsBaseUrl: opsBaseUrl.trim(),
                connectionUrl: connectionUrl.trim() || null,
              });
              setEnrollmentToken('');
            })}
          >
            {t('opsEnroll')}
          </Button>
        </section>
      )}

      {s.hasCredential && (
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold">{t('opsConnectionUrl')}</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} placeholder="https://…" />
            <Button
              disabled={busy}
              onClick={() => run(() => api.post('/ops/forum/connection-url', { connectionUrl: connectionUrl.trim() || null }))}
            >
              {t('opsSaveUrl')}
            </Button>
          </div>
        </section>
      )}

      {s.hasCredential && (
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold">{t('opsFreeGrant')}</h2>
          <p className="text-sm text-muted-foreground">{t('opsFreeGrantHint')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('opsLocalUserId')}</Label>
              <Input value={freeUserId} onChange={(e) => setFreeUserId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('opsCreditsToGrant')}</Label>
              <Input type="number" min="0" value={freeCredits} onChange={(e) => setFreeCredits(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                disabled={busy || !freeUserId}
                onClick={() => run(() => api.post('/ops/forum/credit-orders/free', {
                  localUserId: freeUserId.trim(),
                  creditsToGrant: Number(freeCredits),
                }))}
              >
                {t('opsFreeGrant')}
              </Button>
            </div>
          </div>
        </section>
      )}

      {s.hasCredential && (
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold">{t('opsApplyRotation')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('opsRotationId')}</Label>
              <Input value={rotationId} onChange={(e) => setRotationId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('opsRotationCredential')}</Label>
              <Input type="password" autoComplete="off" value={rotationCredential} onChange={(e) => setRotationCredential(e.target.value)} />
            </div>
          </div>
          <Button
            variant="secondary"
            disabled={busy || !rotationId || !rotationCredential}
            onClick={() => run(async () => {
              await api.post('/ops/forum/rotation/apply', {
                rotationId: rotationId.trim(),
                credential: rotationCredential,
              });
              setRotationCredential('');
              setRotationId('');
            })}
          >
            {t('opsApplyRotation')}
          </Button>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">{t('opsLedgerSync')}</h2>
        <p className="text-sm text-muted-foreground">
          pending={ledger?.stats?.pending ?? 0} · synced={ledger?.stats?.synced ?? 0} · failed={ledger?.stats?.failed ?? 0}
        </p>
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead><tr className="text-left border-b"><th className="py-1 pr-2">seq</th><th className="py-1 pr-2">tx</th><th className="py-1 pr-2">Δ</th><th className="py-1 pr-2">status</th></tr></thead>
            <tbody>
              {(ledger?.items || []).length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">{t('opsNoRows')}</td></tr>}
              {(ledger?.items || []).map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="py-1 pr-2">{row.sequenceNumber}</td>
                  <td className="py-1 pr-2 font-mono">{row.transactionId}</td>
                  <td className="py-1 pr-2">{row.creditDelta}</td>
                  <td className="py-1 pr-2">{row.syncStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t('opsOrders')}</h2>
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead><tr className="text-left border-b"><th className="py-1 pr-2">ref</th><th className="py-1 pr-2">user</th><th className="py-1 pr-2">credits</th><th className="py-1 pr-2">status</th></tr></thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">{t('opsNoRows')}</td></tr>}
              {orders.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="py-1 pr-2 font-mono">{row.orderReference}</td>
                  <td className="py-1 pr-2">{row.localUserId}</td>
                  <td className="py-1 pr-2">{row.creditsToGrant}</td>
                  <td className="py-1 pr-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t('opsDeliveries')}</h2>
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead><tr className="text-left border-b"><th className="py-1 pr-2">event</th><th className="py-1 pr-2">user</th><th className="py-1 pr-2">credits</th><th className="py-1 pr-2">free</th><th className="py-1 pr-2">applied</th></tr></thead>
            <tbody>
              {deliveries.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">{t('opsNoRows')}</td></tr>}
              {deliveries.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="py-1 pr-2 font-mono break-all">{row.eventId}</td>
                  <td className="py-1 pr-2">{row.localUserId}</td>
                  <td className="py-1 pr-2">{row.creditsGranted}</td>
                  <td className="py-1 pr-2">{row.isFreeLaunch ? 'yes' : 'no'}</td>
                  <td className="py-1 pr-2">{fmt(row.appliedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
