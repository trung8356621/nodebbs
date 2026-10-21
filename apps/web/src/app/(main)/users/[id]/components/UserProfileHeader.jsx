'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import Link from '@/components/common/Link';
import Time from '@/components/common/Time';
import UserAvatar from '@/components/user/UserAvatar';
import { UserRoleBadge, UserBadgesList } from '@/components/user/UserIdentityBadges';
import FollowButton from '@/components/user/FollowButton';
import SendMessageButton from '@/components/user/SendMessageButton';
import UserMoreMenu from '@/components/user/UserMoreMenu';
import { useUserProfile } from '@/hooks/user/useUserProfile';

/**
 * 用户主页身份头部（整宽 hero）
 * 头像 + 名称/角色/简介 + 统计 + 操作；在所有可见性下都展示，
 * 内容区（话题/回复 或 受限提示）由 UserView 在其下方渲染。
 */
export default function UserProfileHeader({
  user
}) {
  const pbnT = usePbnTranslations();
  const badges = useMemo(() => user.badges || [], [user.badges]);
  const {
    username,
    followerCount,
    followingCount,
    isFollowing,
    handleFollowChange
  } = useUserProfile({
    user,
    initialFollowerCount: user.followerCount,
    initialFollowingCount: user.followingCount,
    initialIsFollowing: user.isFollowing
  });

  // 统计簇：话题/回复为只读数字，粉丝/关注可跳转
  const stats = [{
    label: pbnT("m68"),
    value: user.topicCount || 0
  }, {
    label: pbnT("m69"),
    value: user.postCount || 0
  }, {
    label: pbnT("m130"),
    value: followerCount,
    href: `/users/${username}/followers`
  }, {
    label: pbnT("m131"),
    value: followingCount,
    href: `/users/${username}/following`
  }];
  return <header className='border-b border-border pb-8 mb-8'>
      <div className='flex flex-col items-center text-center gap-5 sm:flex-row sm:items-start sm:text-left sm:gap-6'>
        {/* 头像 */}
        <UserAvatar url={user.avatar} name={user.name || user.username} size='xl' className='w-24 h-24 shrink-0' frameMetadata={user.avatarFrame?.itemMetadata} />

        {/* 信息区 */}
        <div className='flex-1 min-w-0 w-full space-y-3'>
          {/* 名称 / 角色 + 操作 */}
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start'>
                <h1 className='text-2xl sm:text-3xl font-semibold tracking-tight break-words'>
                  {user.name || user.username}
                </h1>
                <UserRoleBadge user={user} max={Infinity} />
              </div>
              <p className='text-sm text-muted-foreground'>@{user.username}</p>
            </div>

            {/* 操作区（自己/未登录时按钮各自隐藏） */}
            <div className='flex items-center justify-center gap-2 shrink-0'>
              <FollowButton username={username} initialIsFollowing={isFollowing} onFollowChange={handleFollowChange} />
              <SendMessageButton recipientId={user.id} recipientName={user.name || user.username} recipientMessagePermission={user.messagePermission} variant='outline' className='' />
              <UserMoreMenu userId={user.id} username={user.name || user.username} className='shrink-0 text-muted-foreground hover:text-foreground' />
            </div>
          </div>

          {/* 勋章 */}
          {badges.length > 0 && <UserBadgesList badges={badges} size='lg' className='justify-center pt-1 sm:justify-start' />}

          {/* 位置 */}
          {user.location && <div className='flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start'>
              <MapPin className='h-3.5 w-3.5 shrink-0' />
              <span className='break-words'>{user.location}</span>
            </div>}

          {/* 统计簇 + 加入时间 */}
          <div className='flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-sm sm:justify-start'>
            {stats.map(s => {
            const inner = <>
                  <span className='font-semibold text-foreground'>{s.value}</span>
                  <span className='text-muted-foreground'>{s.label}</span>
                </>;
            return s.href ? <Link key={s.label} href={s.href} className='flex items-center gap-1.5 transition-colors hover:text-primary'>
                  {inner}
                </Link> : <span key={s.label} className='flex items-center gap-1.5'>
                  {inner}
                </span>;
          })}
            <span className='flex items-center gap-1.5 text-muted-foreground'>{pbnT("m132")}<Time date={user.createdAt} format='YYYY-MM-DD' />
            </span>
          </div>

          {/* 简介（完整展示，保留换行）— 置于头部最下方 */}
          {user.bio && <p className='max-w-2xl mx-auto whitespace-pre-line break-words text-sm leading-relaxed text-foreground/80 sm:mx-0'>
              {user.bio}
            </p>}
        </div>
      </div>
    </header>;
}
