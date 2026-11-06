'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

const DOMAIN_TYPE = 'domain_subdomains';
const KEYWORD_TYPE = 'keyword';

function blankRule(kind) {
  return {
    category: kind === 'keyword' ? 'custom_keyword' : 'custom_domain',
    type: kind === 'keyword' ? KEYWORD_TYPE : DOMAIN_TYPE,
    value: '',
    action: 'BLOCK',
    enabled: true,
    reason: '',
    priority: 0,
  };
}

export function ContentBlacklistSettings() {
  const pbnT = usePbnTranslations();
  const [tab, setTab] = useState('domains');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/policy/');
      setRules(Array.isArray(data?.rules) ? data.rules.filter((r) => r.scope === 'local') : []);
    } catch (error) {
      toast.error(error.message || pbnT('blacklistLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [pbnT]);

  useEffect(() => {
    load();
  }, [load]);

  const kind = tab === 'keywords' ? 'keyword' : 'domain';
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      const isKeyword = r.type === KEYWORD_TYPE;
      if (kind === 'keyword' ? !isKeyword : isKeyword) return false;
      if (!q) return true;
      return [r.value, r.reason, r.action].join(' ').toLowerCase().includes(q);
    });
  }, [rules, kind, search]);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      toast.success(pbnT('blacklistSaved'));
      setDraft(null);
      setTestResult(null);
      await load();
    } catch (error) {
      toast.error(error.message || pbnT('blacklistSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!draft) return;
    const payload = {
      ...draft,
      category: draft.type === KEYWORD_TYPE ? 'custom_keyword' : (draft.category || 'custom_domain'),
      type: draft.type === KEYWORD_TYPE ? KEYWORD_TYPE : DOMAIN_TYPE,
    };
    await run(async () => {
      await apiClient.request(draft.id ? `/policy/rules/${encodeURIComponent(draft.id)}` : '/policy/rules', {
        method: draft.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
    });
  }

  async function toggleEnabled(rule, enabled) {
    await run(async () => {
      await apiClient.request(`/policy/rules/${encodeURIComponent(rule.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...rule, enabled }),
      });
    });
  }

  async function removeRule(rule) {
    if (!window.confirm(pbnT('blacklistConfirmDelete'))) return;
    await run(async () => {
      await apiClient.delete(`/policy/rules/${encodeURIComponent(rule.id)}`);
    });
  }

  async function runTest() {
    setBusy(true);
    try {
      const body = {
        content: testContent,
        ...(draft?.value
          ? {
              rule: {
                ...draft,
                type: kind === 'keyword' ? KEYWORD_TYPE : DOMAIN_TYPE,
                category: kind === 'keyword' ? 'custom_keyword' : 'custom_domain',
                reason: draft.reason || 'TEST',
              },
            }
          : {}),
      };
      const result = await apiClient.post('/policy/test', body);
      setTestResult(result);
    } catch (error) {
      toast.error(error.message || pbnT('blacklistTestFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingSection description={pbnT('blacklistIntro')}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === 'domains' ? 'default' : 'outline'}
            onClick={() => { setTab('domains'); setDraft(null); setSearch(''); setTestResult(null); }}
          >
            {pbnT('blacklistTabDomains')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'keywords' ? 'default' : 'outline'}
            onClick={() => { setTab('keywords'); setDraft(null); setSearch(''); setTestResult(null); }}
          >
            {pbnT('blacklistTabKeywords')}
          </Button>
        </div>

        <SettingItem title={pbnT('blacklistSearch')} layout="vertical">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={pbnT('blacklistSearch')}
              aria-label={pbnT('blacklistSearch')}
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => setDraft(blankRule(kind))}>
              <Plus className="h-4 w-4 mr-1" />
              {pbnT('blacklistAdd')}
            </Button>
          </div>
        </SettingItem>

        {draft ? (
          <form className="rounded-md border p-4 space-y-3 bg-muted/30" onSubmit={saveDraft}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="bl-value">{kind === 'keyword' ? pbnT('blacklistKeyword') : pbnT('blacklistDomain')}</Label>
                <Input
                  id="bl-value"
                  required
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                  placeholder={kind === 'keyword' ? 'casino online' : 'example.com'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bl-reason">{pbnT('blacklistReason')}</Label>
                <Input
                  id="bl-reason"
                  required
                  value={draft.reason}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bl-action">{pbnT('blacklistAction')}</Label>
                <select
                  id="bl-action"
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={draft.action}
                  onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                >
                  <option value="BLOCK">{pbnT('blacklistBlock')}</option>
                  <option value="REVIEW">{pbnT('blacklistReview')}</option>
                </select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={!!draft.enabled}
                  onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })}
                />
                <span className="text-sm">{pbnT('blacklistActive')}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy}>{pbnT('blacklistSave')}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>{pbnT('blacklistCancel')}</Button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            {pbnT('blacklistLoading')}
          </div>
        ) : (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2 font-medium">{kind === 'keyword' ? pbnT('blacklistKeyword') : pbnT('blacklistDomain')}</th>
                  <th className="p-2 font-medium">{pbnT('blacklistAction')}</th>
                  <th className="p-2 font-medium">{pbnT('blacklistActive')}</th>
                  <th className="p-2 font-medium">{pbnT('blacklistReason')}</th>
                  <th className="p-2 font-medium w-28">{pbnT('blacklistActions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={5}>{pbnT('blacklistEmpty')}</td>
                  </tr>
                ) : visible.map((rule) => (
                  <tr key={rule.id} className="border-b last:border-0">
                    <td className="p-2 break-all max-w-64">{rule.value}</td>
                    <td className="p-2 whitespace-nowrap">{rule.action}</td>
                    <td className="p-2">
                      <Switch
                        checked={!!rule.enabled}
                        disabled={busy}
                        onCheckedChange={(checked) => toggleEnabled(rule, checked)}
                      />
                    </td>
                    <td className="p-2 break-words max-w-72 text-muted-foreground">{rule.reason}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => setDraft({ ...rule })} aria-label={pbnT('blacklistEdit')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => removeRule(rule)} aria-label={pbnT('blacklistDelete')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <SettingItem title={pbnT('blacklistTestTitle')} description={pbnT('blacklistTestDesc')} layout="vertical">
          <div className="space-y-2">
            <textarea
              className="w-full min-h-24 rounded-md border bg-background p-2 text-sm"
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              placeholder={pbnT('blacklistTestPlaceholder')}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy || !testContent.trim()} onClick={runTest}>
              {pbnT('blacklistTestRun')}
            </Button>
            {testResult ? (
              <p className="text-sm">
                <span className="font-medium">{testResult.action}</span>
                {testResult.reason ? ` · ${testResult.reason}` : ''}
                {testResult.ruleIds?.length ? ` · ${testResult.ruleIds.join(', ')}` : ''}
              </p>
            ) : null}
          </div>
        </SettingItem>
      </SettingSection>
    </div>
  );
}
