'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/common/Loading';
import UserProfileHeader from '@/app/(main)/users/[id]/components/UserProfileHeader';
import UserActivityTabs from '@/app/(main)/users/[id]/components/UserActivityTabs';
import { useUserProfile } from '@/hooks/user/useUserProfile';

/**
 * 用户主页（客户端组件）
 * 整宽身份头部 + 下方门控内容（话题/回复 或 受限提示）
 * 全局左导航由 PageLayout 提供
 */
export default function UserView({
  user,
  initialTab,
  initialTopics,
  initialPosts,
  topicsTotal,
  postsTotal,
  currentPage,
  limit
}) {
  const pbnT = usePbnTranslations();
  const {
    canViewContent,
    accessMessage,
    needsAuthCheck,
    authLoading,
    openLoginDialog
  } = useUserProfile({
    user,
    initialFollowerCount: user.followerCount,
    initialFollowingCount: user.followingCount,
    initialIsFollowing: user.isFollowing
  });
  const activityTabs = <UserActivityTabs userId={user.id} initialTab={initialTab} initialTopics={initialTopics} initialPosts={initialPosts} topicsTotal={topicsTotal} postsTotal={postsTotal} currentPage={currentPage} limit={limit} />;
  const renderContent = () => {
    // 公开内容：直接展示
    if (!needsAuthCheck) return activityTabs;
    // 需鉴权且认证状态加载中
    if (authLoading) return <Loading className='py-12' />;
    // 有权限：展示
    if (canViewContent) return activityTabs;
    // 受限：友好提示
    return <div className='card-base mx-auto max-w-md p-10 text-center'>
        <Lock className='mx-auto mb-4 h-12 w-12 text-muted-foreground/40' />
        <h3 className='mb-2 text-lg font-semibold text-foreground'>
          {accessMessage?.title}
        </h3>
        <p className='mb-5 text-sm text-muted-foreground'>
          {accessMessage?.description}
        </p>
        {accessMessage?.showLoginButton && <Button onClick={openLoginDialog}>{pbnT("m2469")}</Button>}
      </div>;
  };
  return <div>
      <UserProfileHeader user={user} />
      {renderContent()}
    </div>;
}
