'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';

function appTone(status) {
  if (status === 'applied') return 'ok';
  if (status === 'skipped_duplicate') return 'muted';
  if (status === 'failed' || status === 'partial') return 'err';
  return 'warn';
}

export function SyncTab({ overview, t, busy, onPublishFromTemplate, onRefresh }) {
  const children = overview?.children || [];
  const applications = overview?.policyApplications || [];
  const policies = overview?.policyVersions || [];
  const [detail, setDetail] = useState(null);
  const isParent = overview?.role === 'parent';
  const isChild = overview?.role === 'child';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('fnSyncIntro')}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={onRefresh}>{t('fnCheckUpdates')}</Button>
          {isParent ? (
            <Button disabled={busy} onClick={onPublishFromTemplate}>{t('fnPublishManaged')}</Button>
          ) : null}
        </div>
      </div>

      {isChild ? (
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-2 font-medium">{t('fnChildSyncState')}</div>
          <div className="grid gap-1 text-muted-foreground">
            <div>{t('fnLocalVersion')}: {overview.managedPolicyVersion || t('fnNotSyncedYet')}</div>
            <div>{t('fnParentVersion')}: {t('fnParentVersionPullCli')}</div>
            <div>{t('fnLastSync')}: {overview.lastSyncAt ? new Date(overview.lastSyncAt).toLocaleString() : t('fnNotSyncedYet')}</div>
            <div>{t('fnParentConn')}: {t('fnParentConnOfflineSafe')}</div>
          </div>
          <pre className="mt-3 overflow-auto rounded bg-muted p-2 text-xs">{overview.provision?.cli?.applyPolicy}</pre>
        </div>
      ) : null}

      {!isParent && !isChild ? (
        <p className="text-sm text-muted-foreground">{t('fnSyncNeedsRole')}</p>
      ) : null}

      {isParent ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t('fnColForum')}</th>
                <th className="px-3 py-2 font-medium">{t('fnLocalVersion')}</th>
                <th className="px-3 py-2 font-medium">{t('fnParentVersion')}</th>
                <th className="px-3 py-2 font-medium">{t('fnLastSync')}</th>
                <th className="px-3 py-2 font-medium">{t('fnColStatus')}</th>
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
                  <td className="px-3 py-2">{row.displayName}</td>
                  <td className="px-3 py-2 text-xs">{t('fnChildLocalUnknown')}</td>
                  <td className="px-3 py-2 text-xs">{overview.managedPolicyVersion || policies[0]?.version || t('fnNotConfigured')}</td>
                  <td className="px-3 py-2 text-xs">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : t('fnNotSyncedYet')}</td>
                  <td className="px-3 py-2"><StatusBadge tone="muted">{t('fnSyncViaCli')}</StatusBadge></td>
                  <td className="px-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setDetail(row)}>{t('fnViewDetails')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium">{t('fnSyncHistory')}</h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t('fnColVersion')}</th>
                <th className="px-3 py-2 font-medium">{t('fnColStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('fnColSource')}</th>
                <th className="px-3 py-2 font-medium">{t('fnLastSync')}</th>
                <th className="px-3 py-2 font-medium">{t('fnLastError')}</th>
                <th className="px-3 py-2 font-medium">{t('fnColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">{t('fnNoSyncHistory')}</td>
                </tr>
              ) : applications.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 text-xs">{row.policyVersion}</td>
                  <td className="px-3 py-2"><StatusBadge tone={appTone(row.status)}>{row.status}</StatusBadge></td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2 text-xs">{row.appliedAt ? new Date(row.appliedAt).toLocaleString() : t('fnDataUnavailable')}</td>
                  <td className="px-3 py-2 text-xs">{row.errorMessage || t('fnNoError')}</td>
                  <td className="px-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setDetail(row)}>{t('fnViewDetails')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isParent ? (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t('fnManualSyncCli')}</p>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{overview.provision?.cli?.exportPolicy}</pre>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{overview.provision?.cli?.applyPolicy}</pre>
        </div>
      ) : null}

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('fnViewDetails')}</DialogTitle>
            <DialogDescription>{t('fnSyncDetailDesc')}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(detail, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
