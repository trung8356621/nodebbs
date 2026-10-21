'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import Link from '@/components/common/Link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { Mail, Loader2, MessageSquare, Trash2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { conversationApi } from '@/lib/api';
import { toast } from 'sonner';
import UserAvatar from '@/components/user/UserAvatar';
import Time from '@/components/common/Time';
import { Loading } from '@/components/common/Loading';
import { Pager } from '@/components/common/Pagination';
import { confirm } from '@/components/common/ConfirmPopover';
export default function MessagesPage() {
  const pbnT = usePbnTranslations();
  const {
    user
  } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [deletingUserId, setDeletingUserId] = useState(null);
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, page, pageSize]);
  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await conversationApi.getList(page, pageSize);
      setConversations(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error("Could not load conversations:", err);
      setError(err.message);
      toast.error(err.message || pbnT("m957"));
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteConversation = async (e, userId, username) => {
    const confirmed = await confirm(e, {
      title: pbnT("m958", {
        arg0: username
      }),
      description: pbnT("m959"),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setDeletingUserId(userId);
    try {
      await conversationApi.deleteConversation(userId);
      toast.success(pbnT("m960"));

      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.user.id !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      console.error("Could not delete conversation:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setDeletingUserId(null);
    }
  };

  // 初始加载状态标记
  const isInitialLoading = loading && conversations.length === 0;
  return <div className="space-y-6">
      <PageHeader title={pbnT("m962")} description={pbnT("m963")} />

      {/* 初始加载状态 */}
      {isInitialLoading ? <Loading text={pbnT("m71")} className="min-h-75" /> : error ? (/* 错误状态 */
    <div className="bg-card border border-destructive/20 rounded-lg p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2">{pbnT("m116")}</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchConversations} variant="outline">{pbnT("m927")}</Button>
        </div>) : conversations.length > 0 ? (/* 会话列表 */
    <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {conversations.map(conversation => {
        const {
          user: otherUser,
          latestMessage,
          unreadCount
        } = conversation;
        const hasUnread = unreadCount > 0;
        return <div key={otherUser.id} className={`group relative overflow-hidden transition duration-300 hover:shadow-md ${hasUnread ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card hover:bg-muted/50'}`}>
                {/* 左侧装饰条 (未读时显示) */}
                {hasUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

                <div className='p-4 pl-5'>
                  <div className='flex items-start space-x-4'>
                    {/* 用户头像 */}
                    <Link href={`/profile/messages/${otherUser.id}`} className="shrink-0">
                      <UserAvatar url={otherUser.avatar} name={otherUser.name || otherUser.username} size='md' className="border-2 border-background shadow-sm transition-transform group-hover:scale-105" />
                    </Link>

                    <Link href={`/profile/messages/${otherUser.id}`} className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between mb-1'>
                        <div className='flex items-center gap-2 max-w-[70%]'>
                          <span className={`text-base font-semibold truncate ${hasUnread ? 'text-primary' : 'text-foreground'}`}>
                            {otherUser.name || otherUser.username}
                          </span>
                        </div>
                        <span className='text-xs text-muted-foreground shrink-0'>
                           <Time date={latestMessage?.createdAt} fromNow />
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                          <p className={`text-sm line-clamp-1 flex-1 ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {latestMessage?.isSentByMe && <span className='text-muted-foreground mr-1'>{pbnT("m964")}</span>}
                            {latestMessage?.content}
                          </p>

                          {/* 未读气泡 */}
                          {hasUnread && <Badge variant="default" className="h-5 w-auto min-w-5 px-1 flex items-center justify-center rounded-full text-[10px] shrink-0">
                                {unreadCount}
                             </Badge>}
                      </div>
                    </Link>

                    {/* 操作菜单 - 仅悬浮显示或在移动端显示 */}
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='h-8 w-8 text-muted-foreground hover:text-foreground' onClick={e => e.stopPropagation()}>
                              <MoreVertical className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem className='text-destructive focus:text-destructive cursor-pointer' disabled={deletingUserId === otherUser.id} onClick={e => {
                      handleDeleteConversation(e, otherUser.id, otherUser.name || otherUser.username);
                    }}>
                              {deletingUserId === otherUser.id ? <>
                                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m965")}</> : <>
                                  <Trash2 className='h-4 w-4' />{pbnT("m966")}</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>;
      })}

          {/* 分页 */}
          {total > pageSize && <div className='p-4'>
              <Pager total={total} page={page} pageSize={pageSize} onPageChange={newPage => setPage(newPage)} />
            </div>}
        </div>) : <div className='bg-card border border-border rounded-lg p-16 text-center'>
          <MessageSquare className='h-16 w-16 text-muted-foreground/50 mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-foreground mb-2'>{pbnT("m967")}</h3>
          <p className='text-sm text-muted-foreground'>{pbnT("m968")}</p>
        </div>}
    </div>;
}
