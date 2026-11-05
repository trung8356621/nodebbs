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

export function TemplatesTab({ overview, t }) {
  const templates = overview?.templates || [];
  const fieldClasses = overview?.fieldClasses || { template: [], managed: [], local: [] };
  const [detail, setDetail] = useState(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('fnTemplatesIntro')}</p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{t('fnColTemplate')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColVersion')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColUpdated')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColConfigCount')}</th>
              <th className="px-3 py-2 font-medium">{t('fnColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">{t('fnNoTemplates')}</td>
              </tr>
            ) : templates.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.description || t('fnNoDescription')}</div>
                </td>
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : t('fnDataUnavailable')}</td>
                <td className="px-3 py-2">{row.configCount}</td>
                <td className="px-3 py-2">
                  <Button variant="outline" size="sm" onClick={() => setDetail(row)}>{t('fnViewDetails')}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['template', fieldClasses.template, 'fnGroupTemplate'],
          ['managed', fieldClasses.managed, 'fnGroupManaged'],
          ['local', fieldClasses.local, 'fnGroupLocal'],
        ].map(([key, list, labelKey]) => (
          <div key={key} className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge tone={key === 'local' ? 'warn' : key === 'managed' ? 'ok' : 'muted'}>{t(labelKey)}</StatusBadge>
            </div>
            <ul className="max-h-40 overflow-auto text-xs text-muted-foreground">
              {(list || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{detail?.editReason || t('fnTemplateReadOnly')}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(detail.groups, null, 2)}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
