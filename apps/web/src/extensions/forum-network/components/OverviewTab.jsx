'use client';

import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';

function Row({ label, value }) {
  return (
    <tr className="border-b last:border-0">
      <th className="py-2 pr-4 text-left text-sm font-medium text-muted-foreground whitespace-nowrap align-top">{label}</th>
      <td className="py-2 text-sm break-all">{value}</td>
    </tr>
  );
}

function roleTone(role) {
  if (role === 'parent') return 'ok';
  if (role === 'child') return 'warn';
  return 'muted';
}

export function OverviewTab({ data, t, busy, onEnableParent }) {
  if (!data) return <p className="text-sm text-muted-foreground">{t('fnLoading')}</p>;

  if (data.schemaMissing) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        {t('fnSchemaMissing')}
      </div>
    );
  }

  const role = data.role || 'none';
  const roleLabel = role === 'parent' ? t('fnRoleParent') : role === 'child' ? t('fnRoleChild') : t('fnRoleIndependent');
  const parentConn = data.parentConnection;
  let parentConnLabel = t('fnParentConnIndependent');
  let parentConnTone = 'muted';
  if (parentConn === 'is_parent') {
    parentConnLabel = t('fnParentConnIsParent');
    parentConnTone = 'ok';
  } else if (parentConn === 'configured_offline_safe') {
    parentConnLabel = t('fnParentConnOfflineSafe');
    parentConnTone = 'ok';
  } else if (parentConn === 'not_linked') {
    parentConnLabel = t('fnParentConnNotLinked');
    parentConnTone = 'warn';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={roleTone(role)}>{roleLabel}</StatusBadge>
        <StatusBadge tone={parentConnTone}>{parentConnLabel}</StatusBadge>
        {data.parentOfflineSafe ? <StatusBadge tone="ok">{t('fnOfflineSafe')}</StatusBadge> : null}
        {!data.opsRequired ? <StatusBadge tone="muted">{t('fnOpsNotRequired')}</StatusBadge> : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[32rem]">
          <tbody>
            <Row label={t('fnForumId')} value={data.forumId || t('fnDataUnavailable')} />
            <Row label={t('fnDomain')} value={data.webOrigin || t('fnDataUnavailable')} />
            <Row label={t('fnDatabase')} value={data.databaseName || t('fnDataUnavailable')} />
            <Row
              label={t('fnParent')}
              value={
                data.parentLink?.parentForumId
                  ? `${data.parentLink.parentForumId}${data.parentLink.parentOrigin ? ` (${data.parentLink.parentOrigin})` : ''}`
                  : t('fnNoParent')
              }
            />
            <Row label={t('fnChildCount')} value={String(data.childCount ?? 0)} />
            <Row label={t('fnTemplateVersion')} value={data.templateVersion || t('fnNotConfigured')} />
            <Row label={t('fnManagedPolicyVersion')} value={data.managedPolicyVersion || t('fnNotSyncedYet')} />
            <Row
              label={t('fnLastSync')}
              value={data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : t('fnNotSyncedYet')}
            />
            <Row label={t('fnTopicRefs')} value={String(data.topicReferenceCount ?? 0)} />
          </tbody>
        </table>
      </div>

      {data.canEnableParent ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy} onClick={onEnableParent}>{t('fnEnableParent')}</Button>
          <p className="text-sm text-muted-foreground">{t('fnEnableParentHint')}</p>
        </div>
      ) : null}

      {data.protectedForum ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t('fnProtectedForum')}</p>
      ) : null}

      {role === 'none' && !data.canEnableParent && !data.protectedForum ? (
        <p className="text-sm text-muted-foreground">{t('fnAlreadyHasRole')}</p>
      ) : null}
    </div>
  );
}
