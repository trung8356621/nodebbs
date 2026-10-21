import { getPbnTranslations } from "@/i18n/server";
import { notFound } from 'next/navigation';
import Link from '@/components/common/Link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import UserAvatar from '@/components/user/UserAvatar';
import { getUserData, getUserFollowing } from '@/lib/server/users';
export async function generateMetadata({
  params
}) {
  const pbnT = await getPbnTranslations();
  const {
    id
  } = await params;
  const user = await getUserData(id, pbnT);
  if (!user) {
    return {
      title: pbnT("m133")
    };
  }
  return {
    title: pbnT("m144", {
      arg0: user.name || user.username
    }),
    description: pbnT("m145", {
      arg0: user.name || user.username
    })
  };
}
export default async function FollowingPage({
  params,
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const {
    id: username
  } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page) || 1;
  const limit = 20;
  const [user, followingData] = await Promise.all([getUserData(username, pbnT), getUserFollowing(username, page, limit, pbnT)]);
  if (!user) {
    notFound();
  }
  const following = followingData.items || [];
  const total = followingData.total || 0;
  const totalPages = Math.ceil(total / limit);
  return <div className='px-4 py-8'>
      <div className='max-w-3xl mx-auto'>
        {/* 返回按钮 */}
        <Link href={`/users/${username}`} className='inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6'>
          <ArrowLeft className='h-4 w-4 mr-1' />{pbnT("m136")}</Link>

        {/* 标题 */}
        <div className='mb-6'>
          <h1 className='text-2xl font-bold mb-2'>
            {user.name || user.username}{" "}{pbnT("m146")}</h1>
          <p className='text-muted-foreground'>{pbnT("m147")}{" "}{total}{" "}{pbnT("m148")}</p>
        </div>

        {/* 关注列表 */}
        {following.length === 0 ? <div className='text-center py-12 bg-card border border-border rounded-lg'>
            <Users className='h-12 w-12 text-muted-foreground/50 mx-auto mb-4' />
            <p className='text-muted-foreground'>{pbnT("m149")}</p>
          </div> : <>
            <div className='bg-card border border-border rounded-lg divide-y divide-border'>
              {following.map(user => <Link key={user.id} href={`/users/${user.username}`} className='flex items-center gap-4 p-4 hover:bg-accent transition-colors'>
                  <UserAvatar url={user.avatar} name={user.name || user.username} size='lg' />
                  <div className='flex-1 min-w-0'>
                    <div className='font-semibold text-foreground'>
                      {user.name || user.username}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      @{user.username}
                    </div>
                    {user.bio && <div className='text-sm text-muted-foreground line-clamp-1 mt-1'>
                        {user.bio}
                      </div>}
                  </div>
                </Link>)}
            </div>

            {/* 分页 */}
            {totalPages > 1 && <div className='flex items-center justify-center gap-2 mt-6'>
                <Button variant='outline' size='sm' asChild disabled={page === 1}>
                  <Link href={`/users/${username}/following?page=${page - 1}`}>{pbnT("m140")}</Link>
                </Button>
                <span className='text-sm text-muted-foreground'>{pbnT("m141")}{" "}{page} / {totalPages}{" "}{pbnT("m142")}</span>
                <Button variant='outline' size='sm' asChild disabled={page === totalPages}>
                  <Link href={`/users/${username}/following?page=${page + 1}`}>{pbnT("m143")}</Link>
                </Button>
              </div>}
          </>}
      </div>
    </div>;
}
