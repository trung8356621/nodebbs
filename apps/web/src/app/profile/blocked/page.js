'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import Link from '@/components/common/Link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { ShieldOff, UserX, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { blockedUsersApi } from '@/lib/api';
import { toast } from 'sonner';
import UserAvatar from '@/components/user/UserAvatar';
import Time from '@/components/common/Time';
import { Loading } from '@/components/common/Loading';
import { Pager } from '@/components/common/Pagination';
import { ConfirmPopover } from '@/components/common/ConfirmPopover';
export default function BlockedUsersPage() {
  const pbnT = usePbnTranslations();
  const {
    user
  } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [unblockingUserId, setUnblockingUserId] = useState(null);
  useEffect(() => {
    if (user) {
      fetchBlockedUsers();
    }
  }, [user, page, pageSize]);
  const fetchBlockedUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await blockedUsersApi.getList(page, pageSize);
      setBlockedUsers(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error("Could not load blocked users:", err);
      setError(err.message);
      toast.error(err.message || pbnT("m921"));
    } finally {
      setLoading(false);
    }
  };
  const handleUnblock = async (userId, username) => {
    setUnblockingUserId(userId);
    try {
      await blockedUsersApi.unblock(userId);
      toast.success(pbnT("m922", {
        arg0: username
      }));
      setBlockedUsers(prev => prev.filter(u => u.blockedUserId !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      console.error("Could not unblock:", err);
      toast.error(err.message || pbnT("m924"));
    } finally {
      setUnblockingUserId(null);
    }
  };

  // 初始加载状态标记
  const isInitialLoading = loading && blockedUsers.length === 0;
  return <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader title={pbnT("m925")} description={pbnT("m926")} />

      {/* 初始加载状态 */}
      {isInitialLoading ? <Loading text={pbnT("m71")} className="min-h-75" /> : error ? (/* 错误状态 */
    <Card className="border-destructive/20 shadow-none">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-medium mb-2">{pbnT("m116")}</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchBlockedUsers} variant="outline">{pbnT("m927")}</Button>
          </CardContent>
        </Card>) : <>
          {/* 拉黑用户列表 */}
          {blockedUsers.length > 0 ? <div className="space-y-3">
              {blockedUsers.map(blockedUser => <Card key={blockedUser.id} className="group shadow-none hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* 用户头像 */}
                      <Link href={`/users/${blockedUser.blockedUsername}`} className="shrink-0">
                        <UserAvatar url={blockedUser.blockedAvatar} name={blockedUser.blockedName || blockedUser.blockedUsername} size="lg" />
                      </Link>

                      {/* 用户信息 */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/users/${blockedUser.blockedUsername}`} className="group/link">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground group-hover/link:text-primary transition-colors">
                              {blockedUser.blockedName || blockedUser.blockedUsername}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              @{blockedUser.blockedUsername}
                            </span>
                          </div>
                        </Link>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <Time date={blockedUser.createdAt} fromNow />
                          </span>
                          {blockedUser.reason && <span className="truncate max-w-50" title={blockedUser.reason}>{pbnT("m385")}{" "}{blockedUser.reason}
                            </span>}
                        </div>
                      </div>

                      {/* 取消拉黑按钮 */}
                      <ConfirmPopover title={pbnT("m928", {
                arg0: blockedUser.blockedName || blockedUser.blockedUsername
              })} description={pbnT("m929")} confirmText={pbnT("m930")} onConfirm={() => handleUnblock(blockedUser.blockedUserId, blockedUser.blockedName || blockedUser.blockedUsername)}>
                        <Button variant="outline" size="sm" disabled={unblockingUserId === blockedUser.blockedUserId} className="shrink-0 gap-1.5 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
                          {unblockingUserId === blockedUser.blockedUserId ? <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />{pbnT("m931")}</> : <>
                              <ShieldOff className="h-3.5 w-3.5" />{pbnT("m930")}</>}
                        </Button>
                      </ConfirmPopover>
                    </div>
                  </CardContent>
                </Card>)}
            </div> : <Card className="shadow-none border-dashed">
              <CardContent className="py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <UserX className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-2">{pbnT("m932")}</h3>
                <p className="text-muted-foreground">{pbnT("m933")}</p>
              </CardContent>
            </Card>}

          {/* 分页 */}
          {total > pageSize && <Pager total={total} page={page} pageSize={pageSize} onPageChange={newPage => setPage(newPage)} />}
        </>}
    </div>;
}
