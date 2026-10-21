'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { moderationApi } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from '@/components/common/Link';
import { Loading } from '@/components/common/Loading';
import { Pager } from '@/components/common/Pagination';

/**
 * 统一审核队列列表。
 * type: 'all' | 'topic' | 'post' | ...（由已注册审核类型动态决定）
 * 数据来源：GET /moderation/queue（moderation_items 队列，经适配器 describe 富化）。
 */
export function PendingContent({
  type = 'all',
  status = 'pending',
  onModerationComplete
}) {
  const pbnT = usePbnTranslations();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    loadQueue();
  }, [type, status, page, pageSize]);
  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await moderationApi.getQueue(type, status, page, pageSize);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load moderation queue:', error);
      toast.error(pbnT("m351"));
    } finally {
      setLoading(false);
    }
  };
  const afterAction = () => {
    loadQueue();
    if (onModerationComplete) onModerationComplete();
  };
  const handleApprove = async item => {
    try {
      await moderationApi.approveItem(item.id);
      toast.success(pbnT("m352", {
        arg0: item.typeLabel || pbnT("m353")
      }));
      afterAction();
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error(error.message || pbnT("m354"));
    }
  };
  const handleReject = async item => {
    try {
      await moderationApi.rejectItem(item.id);
      toast.success(pbnT("m355", {
        arg0: item.typeLabel || pbnT("m353")
      }));
      afterAction();
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error(error.message || pbnT("m356"));
    }
  };
  const handlePageChange = newPage => setPage(newPage);
  const handlePageSizeChange = newPageSize => {
    setPageSize(newPageSize);
    setPage(1);
  };
  if (loading && items.length === 0) {
    return <Loading text={pbnT("m71")} className='py-12' />;
  }

  // 按 describe 返回的 layout 渲染内容主体（与 targetType 解耦；新类型复用已有 layout 即可，无需改此处）
  const renderBody = item => {
    const d = item.detail || {};
    const layout = d.layout || item.targetType; // 兼容未富化/未知
    if (layout === 'topic') {
      return <div>
          <h3 className='text-lg font-semibold mb-2'>{d.title || pbnT("m357", {
            arg0: item.targetId
          })}</h3>
          {d.preview && <p className='text-sm text-muted-foreground mb-2 line-clamp-3'>{d.preview}</p>}
          <Link href={`/topic/${item.targetId}`} className='text-sm text-primary hover:underline'>{pbnT("m358")}</Link>
        </div>;
    }
    if (layout === 'post') {
      return <div>
          <p className='text-sm text-muted-foreground mb-2'>{pbnT("m359")}{' '}
            <Link href={`/topic/${d.topicId}`} className='text-primary hover:underline'>
              {d.topicTitle || `#${d.topicId}`}
            </Link>
          </p>
          {d.preview && <p className='text-sm line-clamp-3'>{d.preview}</p>}
        </div>;
    }
    // 文本字段变更（昵称/简介/…）：原值 → 新值
    if (layout === 'text-diff') {
      return <div className='space-y-1'>
          <div className='text-sm'>
            <span className='text-muted-foreground'>{pbnT("m360")}</span>
            <span className='line-through text-muted-foreground break-all'>{d.oldValue || pbnT("m361")}</span>
          </div>
          <div className='text-sm'>
            <span className='text-muted-foreground'>{pbnT("m362")}</span>
            <span className='font-medium break-all'>{d.newValue || pbnT("m361")}</span>
          </div>
          {d.username && <Link href={`/users/${d.username}`} className='text-sm text-primary hover:underline'>{pbnT("m363")}</Link>}
        </div>;
    }
    // 图片字段变更（头像/…）：新旧缩略图对比
    if (layout === 'image-diff') {
      return <div className='space-y-2'>
          <div className='flex items-center gap-6'>
            <div className='text-center'>
              <p className='text-xs text-muted-foreground mb-1'>{pbnT("m364")}</p>
              {d.oldValue ? <img src={d.oldValue} alt={pbnT("m364")} className='h-16 w-16 rounded-full object-cover border' /> : <div className='h-16 w-16 rounded-full border flex items-center justify-center text-xs text-muted-foreground'>{pbnT("m365")}</div>}
            </div>
            <span className='text-muted-foreground'>→</span>
            <div className='text-center'>
              <p className='text-xs text-muted-foreground mb-1'>{pbnT("m366")}</p>
              <img src={d.newValue} alt={pbnT("m366")} className='h-16 w-16 rounded-full object-cover border' />
            </div>
          </div>
          {d.username && <Link href={`/users/${d.username}`} className='text-sm text-primary hover:underline'>{pbnT("m363")}</Link>}
        </div>;
    }
    // 留言/评论类：正文 + 上下文链接
    if (layout === 'message') {
      return <div className='space-y-1'>
          <p className='text-sm break-all'>{d.newValue || d.preview}</p>
          {d.href && <Link href={d.href} className='text-sm text-primary hover:underline'>{pbnT("m367")}</Link>}
        </div>;
    }
    // 兜底：未知类型（未来扩展）
    return <div>
        <p className='text-sm line-clamp-3'>{d.preview || d.title || `#${item.targetId}`}</p>
      </div>;
  };
  return <div className='space-y-4'>
      {items.length === 0 ? <div className='border border-border rounded-lg p-12 bg-card'>
          <div className='text-center text-muted-foreground'>
            <Clock className='h-12 w-12 mx-auto mb-4 opacity-50' />
            <p>{pbnT("m368")}</p>
          </div>
        </div> : <>
          <div className='space-y-4'>
            {items.map(item => <div key={item.id} className='border border-border rounded-lg p-6 bg-card hover:border-muted-foreground/50 transition-colors'>
                <div className='space-y-4'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-2'>
                        <Badge variant={item.targetType === 'topic' ? 'default' : 'secondary'}>
                          {item.typeLabel || item.targetType}
                        </Badge>
                        {item.status && item.status !== 'pending' && <span className={`text-xs font-medium ${item.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.status === 'approved' ? pbnT("m369") : pbnT("m370")}
                          </span>}
                        <span className='text-sm text-muted-foreground'>{pbnT("m371")}{" "}{item.submitterUsername || pbnT("m372")}{" "}{pbnT("m373")}{' '}
                          {new Date(item.createdAt).toLocaleString(pbnT.locale)}
                        </span>
                      </div>
                      {renderBody(item)}
                    </div>
                  </div>

                  {item.status === 'pending' ? <div className='flex gap-2'>
                      <Button size='sm' onClick={() => handleApprove(item)} className='gap-2'>
                        <CheckCircle className='h-4 w-4' />{pbnT("m374")}</Button>
                      <Button size='sm' variant='destructive' onClick={() => handleReject(item)} className='gap-2'>
                        <XCircle className='h-4 w-4' />{pbnT("m375")}</Button>
                    </div> : <div className='text-xs text-muted-foreground'>
                      {item.status === 'approved' ? pbnT("m369") : pbnT("m370")}
                      {item.reviewedAt && ` · ${new Date(item.reviewedAt).toLocaleString(pbnT.locale)}`}
                      {item.reason && pbnT("m376", {
                arg0: item.reason
              })}
                    </div>}
                </div>
              </div>)}
          </div>

          {total > 0 && <Pager total={total} page={page} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} pageSizeOptions={[10, 20, 50]} />}
        </>}
    </div>;
}
