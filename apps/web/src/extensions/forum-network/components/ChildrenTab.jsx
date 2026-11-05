'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';

function childStatusTone(status) {
  if (status === 'active') return 'ok';
  if (status === 'provisioning') return 'warn';
  if (status === 'failed') return 'err';
  return 'muted';
}

export function ChildrenTab({
  overview,
  t,
  busy,
  onDraftChild,
  draftResult,
}) {
  const children = overview?.children || [];
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    id: '',
    domain: '',
    database: '',
    adminUsernameHint: '',
    locale: 'vi-VN',
    templateId: 'default',
    freeMonths: 2,
    webPort: '',
    apiPort: '',
  });

  const canDraft = overview?.role === 'parent';
  const steps = useMemo(() => [
    t('fnWizardStepName'),
    t('fnWizardStepDomain'),
    t('fnWizardStepDatabase'),
    t('fnWizardStepAdmin'),
    t('fnWizardStepLocale'),
    t('fnWizardStepTemplate'),
    t('fnWizardStepFreeMode'),
    t('fnWizardStepConfirm'),
  ], [t]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openWizard = () => {
    setStep(0);
    setWizardOpen(true);
  };

  const submitDraft = async () => {
    const payload = {
      name: form.name.trim(),
      id: form.id.trim(),
      database: form.database.trim(),
      domain: form.domain.trim() || undefined,
      locale: form.locale,
      templateId: form.templateId || 'default',
      freeMonths: Number(form.freeMonths) || 2,
      adminUsernameHint: form.adminUsernameHint.trim() || undefined,
      webPort: form.webPort ? Number(form.webPort) : undefined,
      apiPort: form.apiPort ? Number(form.apiPort) : undefined,
    };
    await onDraftChild(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('fnChildrenIntro')}</p>
        <Button disabled={!canDraft || busy} onClick={openWizard}>{t('fnCreateChild')}</Button>
      </div>

      {!canDraft ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t('fnCreateChildNeedsParent')}</p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{t('fnColForum')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColDomain')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColRole')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColStatus')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColSync')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {children.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">{t('fnNoChildren')}</td>
              </tr>
            ) : children.map((row) => (
              <tr key={row.childForumId} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.displayName}</div>
                  <div className="text-xs text-muted-foreground">{row.childForumId} · {row.databaseName}</div>
                </td>
                <td className="px-3 py-2">{row.webOrigin || t('fnDataUnavailable')}</td>
                <td className="px-3 py-2"><StatusBadge tone="warn">{t('fnRoleChild')}</StatusBadge></td>
                <td className="px-3 py-2">
                  <StatusBadge tone={childStatusTone(row.status)}>{row.status || t('fnDataUnavailable')}</StatusBadge>
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : t('fnNotSyncedYet')}
                </td>
                <td className="px-3 py-2">
                  <Button variant="outline" size="sm" onClick={() => setDetail(row)}>{t('fnViewDetails')}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.displayName}</DialogTitle>
            <DialogDescription>{t('fnChildDetailDesc')}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify({
                childForumId: detail.childForumId,
                databaseName: detail.databaseName,
                webOrigin: detail.webOrigin,
                apiOrigin: detail.apiOrigin,
                status: detail.status,
                templateId: detail.templateId,
                freeModeExpiresAt: detail.freeModeExpiresAt,
                meta: detail.meta,
                createdAt: detail.createdAt,
                updatedAt: detail.updatedAt,
              }, null, 2)}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('fnCreateChild')}</DialogTitle>
            <DialogDescription>
              {t('fnWizardProgress', { step: step + 1, total: steps.length, label: steps[step] })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {step === 0 ? (
              <>
                <Label htmlFor="fn-name">{t('fnFieldName')}</Label>
                <Input id="fn-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
                <Label htmlFor="fn-id">{t('fnFieldId')}</Label>
                <Input id="fn-id" value={form.id} onChange={(e) => set('id', e.target.value)} placeholder="forum_x" />
              </>
            ) : null}
            {step === 1 ? (
              <>
                <Label htmlFor="fn-domain">{t('fnFieldDomain')}</Label>
                <Input id="fn-domain" value={form.domain} onChange={(e) => set('domain', e.target.value)} placeholder="https://child.example.com" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="fn-web">{t('fnFieldWebPort')}</Label>
                    <Input id="fn-web" value={form.webPort} onChange={(e) => set('webPort', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="fn-api">{t('fnFieldApiPort')}</Label>
                    <Input id="fn-api" value={form.apiPort} onChange={(e) => set('apiPort', e.target.value)} />
                  </div>
                </div>
              </>
            ) : null}
            {step === 2 ? (
              <>
                <Label htmlFor="fn-db">{t('fnFieldDatabase')}</Label>
                <Input id="fn-db" value={form.database} onChange={(e) => set('database', e.target.value)} placeholder="pbn_forum_x" />
                <p className="text-xs text-muted-foreground">{t('fnDatabaseHint')}</p>
              </>
            ) : null}
            {step === 3 ? (
              <>
                <Label htmlFor="fn-admin">{t('fnFieldAdminHint')}</Label>
                <Input id="fn-admin" value={form.adminUsernameHint} onChange={(e) => set('adminUsernameHint', e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('fnAdminHint')}</p>
              </>
            ) : null}
            {step === 4 ? (
              <>
                <Label htmlFor="fn-locale">{t('fnFieldLocale')}</Label>
                <select
                  id="fn-locale"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.locale}
                  onChange={(e) => set('locale', e.target.value)}
                >
                  <option value="vi-VN">vi-VN</option>
                  <option value="en-US">en-US</option>
                </select>
              </>
            ) : null}
            {step === 5 ? (
              <>
                <Label htmlFor="fn-template">{t('fnFieldTemplate')}</Label>
                <Input id="fn-template" value={form.templateId} onChange={(e) => set('templateId', e.target.value)} />
              </>
            ) : null}
            {step === 6 ? (
              <>
                <Label htmlFor="fn-free">{t('fnFieldFreeMonths')}</Label>
                <select
                  id="fn-free"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.freeMonths}
                  onChange={(e) => set('freeMonths', Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </>
            ) : null}
            {step === 7 ? (
              <div className="space-y-2 text-sm">
                <p>{t('fnWizardConfirmNote')}</p>
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(form, null, 2)}</pre>
              </div>
            ) : null}

            {draftResult ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                <p className="font-medium">{t('fnDraftReady')}</p>
                <p className="mt-1 text-muted-foreground">{t('fnDraftNotProvisioned')}</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs">{draftResult.command}</pre>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs">{JSON.stringify(draftResult.draft, null, 2)}</pre>
              </div>
            ) : null}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>{t('fnBack')}</Button>
            {step < steps.length - 1 ? (
              <Button disabled={busy} onClick={() => setStep((s) => s + 1)}>{t('fnNext')}</Button>
            ) : (
              <Button disabled={busy} onClick={submitDraft}>{t('fnGenerateDraft')}</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
