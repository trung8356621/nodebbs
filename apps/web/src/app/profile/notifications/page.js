'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import Link from '@/components/common/Link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { Bell, CheckCheck, Trash2, Loader2, BellOff } from 'lucide-react';
import { getNotificationIcon, getNotificationMessage } from '@/components/common/Notification';
import UserAvatar from '@/components/user/UserAvatar';
import Time from '@/components/common/Time';
import { Loading } from '@/components/common/Loading';
import { Pager } from '@/components/common/Pagination';
import { ConfirmPopover } from '@/components/common/ConfirmPopover';

// 导入 Hook
import { useNotifications } from '@/hooks/profile/useNotifications';

/**
 * 通知页面
 * 纯 UI 组件，消费 useNotifications Hook
 */
export default function NotificationsPage() {
  const pbnT = usePbnTranslations();
  const {
    // 列表数据
    notifications,
    loading,
    error,
    page,
    pageSize,
    total,
    unreadCount,
    readCount,
    filter,
    setPage,
    // 操作函数
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    handleFilterChange,
    // 加载状态
    isActionLoading
  } = useNotifications();

  // 初始加载状态标记
  const isInitialLoading = loading && notifications.length === 0;
  return <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader title={pbnT("m986")} description={pbnT("m987")} />

      {/* 筛选和操作按钮 - 始终显示 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer transition-colors" onClick={() => handleFilterChange('all')}>{pbnT("m307")}</Badge>
          <Badge variant={filter === 'unread' ? 'default' : 'outline'} className="cursor-pointer transition-colors" onClick={() => handleFilterChange('unread')}>{pbnT("m988")}</Badge>
          <Badge variant={filter === 'read' ? 'default' : 'outline'} className="cursor-pointer transition-colors" onClick={() => handleFilterChange('read')}>{pbnT("m989")}</Badge>
        </div>

        <div className="flex items-center gap-2 min-h-8">
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={isActionLoading('read-all')} className="h-8 gap-1.5">
              {isActionLoading('read-all') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}{pbnT("m990")}</Button>}
          {readCount > 0 && <ConfirmPopover title={pbnT("m991")} description={pbnT("m992")} confirmText={pbnT("m993")} variant="destructive" onConfirm={deleteAllRead}>
              <Button variant="ghost" size="sm" disabled={isActionLoading('delete-all-read')} className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                {isActionLoading('delete-all-read') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{pbnT("m994")}</Button>
            </ConfirmPopover>}
        </div>
      </div>

      {/* 初始加载状态 */}
      {isInitialLoading ? <Loading text={pbnT("m71")} className="min-h-50" /> : error ? (/* 错误状态 */
    <Card className="border-destructive/20 shadow-none">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-medium mb-2">{pbnT("m116")}</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchNotifications} variant="outline">{pbnT("m927")}</Button>
          </CardContent>
        </Card>) : notifications.length > 0 ? (/* 通知列表 */
    <div className="space-y-3">
          {notifications.map(notification => <Card key={notification.id} className={`group shadow-none transition-colors ${!notification.isRead ? 'border-primary/30 bg-primary/2' : 'hover:border-border/80'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* 未读指示器 + 头像 */}
                      <div className="relative shrink-0">
                        <UserAvatar name={notification.triggeredByName || notification.triggeredByUsername} url={notification.triggeredByAvatar} size="md" />
                        {!notification.isRead && <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full ring-2 ring-background" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 通知内容 */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="inline-flex items-center gap-1">
                              {getNotificationIcon(notification.type)}
                            </span>
                            {notification.triggeredByUsername && <span className="font-medium text-foreground">
                                {notification.triggeredByName || notification.triggeredByUsername}
                              </span>}
                            <span className="text-muted-foreground">
                              {getNotificationMessage(notification)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            <Time date={notification.createdAt} fromNow />
                          </span>
                        </div>

                        {/* 话题链接 */}
                        {notification.topicTitle && <Link href={`/topic/${notification.topicId}${notification.postId ? `#post-${notification.postId}` : ''}`} className="text-sm text-primary hover:underline block mb-2 truncate">
                            {notification.topicTitle}
                          </Link>}

                        {/* 举报处理结果链接 */}
                        {(notification.type === 'report_resolved' || notification.type === 'report_dismissed') && (() => {
                try {
                  const meta = typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : notification.metadata;
                  let href = null;
                  let label = pbnT("m465");
                  if (meta) {
                    if (meta.reportType === 'topic' && meta.targetId) {
                      href = `/topic/${meta.targetId}`;
                      label = pbnT("m833");
                    } else if (meta.reportType === 'post' && meta.topicId && meta.targetId) {
                      href = `/topic/${meta.topicId}#post-${meta.targetId}`;
                      label = pbnT("m437");
                    } else if (meta.reportType === 'user' && meta.targetUsername) {
                      href = `/users/${meta.targetUsername}`;
                      label = pbnT("m995");
                    }
                  }
                  return href ? <Link href={href} className="text-sm text-primary hover:underline block mb-2 truncate">
                                {label}
                              </Link> : null;
                } catch {
                  return null;
                }
              })()}

                        {/* 审核结果内容链接（驳回时仅 entity 内容带 link） */}
                        {(notification.type === 'moderation_approved' || notification.type === 'moderation_rejected') && (() => {
                try {
                  const meta = typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : notification.metadata;
                  return meta?.link ? <Link href={meta.link} className="text-sm text-primary hover:underline block mb-2 truncate">{pbnT("m996")}</Link> : null;
                } catch {
                  return null;
                }
              })()}

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.isRead && <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)} disabled={isActionLoading(`read-${notification.id}`)} className="h-7 px-2 text-xs gap-1">
                              {isActionLoading(`read-${notification.id}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}{pbnT("m997")}</Button>}
                          <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)} disabled={isActionLoading(`delete-${notification.id}`)} className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                            {isActionLoading(`delete-${notification.id}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}{pbnT("m110")}</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}

              {/* 分页 */}
              {total > pageSize && <Pager total={total} page={page} pageSize={pageSize} onPageChange={newPage => setPage(newPage)} />}
            </div>) : <Card className="shadow-none border-dashed">
              <CardContent className="py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <BellOff className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {filter === 'unread' ? pbnT("m998") : filter === 'read' ? pbnT("m999") : pbnT("m1000")}
                </h3>
                <p className="text-muted-foreground">
                  {filter === 'all' ? pbnT("m1001") : pbnT("m1002")}
                </p>
          </CardContent>
            </Card>}
    </div>;
}
