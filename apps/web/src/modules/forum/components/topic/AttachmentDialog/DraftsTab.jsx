'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect, useState } from 'react';
import { ArrowRight, Files, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatFileSize } from '@/utils/format';
import { getAttachmentIcon, getPolicyLabel } from '@/utils/attachment';
const LIMIT = 20;

/**
 * 「草稿」Tab：当前用户尚未绑定到任何话题的附件，可插入 / 编辑 / 删除。
 *
 * @param {object} props
 * @param {number} props.refreshKey - 父组件递增以触发刷新
 * @param {(attachmentId:number)=>void} props.onInsert
 * @param {(draft:object)=>void} props.onEdit
 */
export default function DraftsTab({
  refreshKey,
  onInsert,
  onEdit
}) {
  const pbnT = usePbnTranslations();
  const [drafts, setDrafts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/attachments/drafts?page=${page}&limit=${LIMIT}`).then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || pbnT("m2203"));
      }
      return res.json();
    }).then(d => {
      if (cancelled) return;
      setDrafts(d.drafts ?? []);
      setTotal(d.total ?? 0);
    }).catch(err => !cancelled && setError(err.message)).finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/attachments/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || pbnT("m249"));
        return;
      }
      toast.success(pbnT("m2204"));
      setDrafts(prev => prev.filter(d => d.id !== deleteTarget.id));
      setTotal(t => Math.max(0, t - 1));
      setDeleteTarget(null);
    } catch {
      toast.error(pbnT("m1362"));
    } finally {
      setDeleting(false);
    }
  };
  if (loading && drafts.length === 0) {
    return <div className="py-8 text-sm text-muted-foreground text-center">{pbnT("m1406")}</div>;
  }
  if (error) {
    return <div className="py-8 text-sm text-destructive text-center">{error}</div>;
  }
  if (drafts.length === 0) {
    return <div className="py-8 text-sm text-muted-foreground text-center">{pbnT("m2205")}</div>;
  }
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  return <div className="pt-4 space-y-2">
      {drafts.map(d => {
      const Icon = d.fileCount === 1 ? getAttachmentIcon(d.files[0]?.mimetype, d.files[0]?.name) : Files;
      return <div key={d.id} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {d.fileCount}{" "}{pbnT("m1365")}{" "}{' · '}
                  {formatFileSize(d.totalSize)}
                  {' · '}
                  {getPolicyLabel(d.policy, pbnT)}
                  {d.policy === 'points' && pbnT("m2206", {
                arg0: d.pointsCost
              })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onInsert?.(d.id)}>
                <ArrowRight className="h-3 w-3" />{pbnT("m1346")}</Button>
              <Button size="sm" variant="outline" onClick={() => onEdit?.(d)}>
                <Pencil className="h-3 w-3" />{pbnT("m235")}</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(d)}>
                <Trash2 className="h-3 w-3" />{pbnT("m110")}</Button>
            </div>
          </div>;
    })}

      {totalPages > 1 && <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>{pbnT("m75")}{" "}{total}{" "}{pbnT("m2207")}{" "}{page} / {totalPages}{" "}{pbnT("m142")}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{pbnT("m140")}</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{pbnT("m143")}</Button>
          </div>
        </div>}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pbnT("m2208")}</AlertDialogTitle>
            <AlertDialogDescription>{pbnT("m2209")}{deleteTarget?.title}{pbnT("m2210")}{" "}{deleteTarget?.fileCount}{" "}{pbnT("m2211")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pbnT("m486")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}{pbnT("m110")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}
