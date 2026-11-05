'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Network, LayoutDashboard, Baby, FileStack, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { usePermission } from '@/hooks/usePermission';
import { forumNetworkApi } from '../api';
import { OverviewTab } from '../components/OverviewTab';
import { ChildrenTab } from '../components/ChildrenTab';
import { TemplatesTab } from '../components/TemplatesTab';
import { SyncTab } from '../components/SyncTab';

const TAB_IDS = new Set(['overview', 'children', 'templates', 'sync']);

function normalizeTab(raw) {
  return TAB_IDS.has(raw) ? raw : 'overview';
}

export default function ForumNetworkAdminPage() {
  const t = usePbnTranslations();
  const { hasPermission } = usePermission();
  const allowed = hasPermission('dashboard.extensions');
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => normalizeTab(searchParams.get('tab')), [searchParams]);
  const [tab, setTab] = useState(initial);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftResult, setDraftResult] = useState(null);

  useEffect(() => { setTab(initial); }, [initial]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await forumNetworkApi.overview();
      setOverview(res?.data || res);
    } catch (err) {
      setError(err?.message || t('fnLoadError'));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  const onTabChange = (value) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'overview') params.delete('tab');
    else params.set('tab', value);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/forum-network?${qs}` : '/dashboard/forum-network', { scroll: false });
  };

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      toast.error(err?.message || t('fnLoadError'));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">{t('fnForbidden')}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('fnTitle')} description={t('fnDescription')} />

      {loading ? <p className="text-sm text-muted-foreground">{t('fnLoading')}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <Tabs value={tab} onValueChange={onTabChange} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="h-4 w-4" />{t('fnTabOverview')}</TabsTrigger>
            <TabsTrigger value="children" className="gap-2"><Baby className="h-4 w-4" />{t('fnTabChildren')}</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2"><FileStack className="h-4 w-4" />{t('fnTabTemplates')}</TabsTrigger>
            <TabsTrigger value="sync" className="gap-2"><RefreshCw className="h-4 w-4" />{t('fnTabSync')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              data={overview}
              t={t}
              busy={busy}
              onEnableParent={() => run(() => forumNetworkApi.enableParent(), t('fnEnableParentOk'))}
            />
          </TabsContent>

          <TabsContent value="children">
            <ChildrenTab
              overview={overview}
              t={t}
              busy={busy}
              draftResult={draftResult}
              onDraftChild={async (body) => {
                setBusy(true);
                try {
                  const res = await forumNetworkApi.draftChild(body);
                  setDraftResult(res?.data || res);
                  toast.success(t('fnDraftReady'));
                } catch (err) {
                  toast.error(err?.message || t('fnLoadError'));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab overview={overview} t={t} />
          </TabsContent>

          <TabsContent value="sync">
            <SyncTab
              overview={overview}
              t={t}
              busy={busy}
              onRefresh={() => run(async () => {}, t('fnCheckUpdatesOk'))}
              onPublishFromTemplate={() => run(
                () => forumNetworkApi.publishFromTemplate({ templateId: 'default' }),
                t('fnPublishOk'),
              )}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Network className="h-3.5 w-3.5" />
        {t('fnFooterNote')}
      </p>
    </div>
  );
}
