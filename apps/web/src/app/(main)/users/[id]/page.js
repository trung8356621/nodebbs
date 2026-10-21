import { getPbnTranslations } from "@/i18n/server";
import { notFound } from 'next/navigation';
import { getUserData, getUserTopics, getUserPosts } from '@/lib/server/users';
import { UserView } from '@/modules/forum/ui';

// 生成页面元数据（SEO优化）
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
    title: pbnT("m150", {
      arg0: user.name || user.username
    }),
    description: pbnT("m151", {
      arg0: user.name || user.username
    }),
    openGraph: {
      title: pbnT("m150", {
        arg0: user.name || user.username
      }),
      description: pbnT("m152", {
        arg0: user.name || user.username
      }),
      type: 'profile'
    }
  };
}

// 主页面组件（服务端组件）
export default async function UserProfilePage({
  params,
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const {
    id
  } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab || 'topics';
  const currentPage = parseInt(resolvedSearchParams.page) || 1;
  const LIMIT = 20;

  // 获取用户数据
  const user = await getUserData(id, pbnT);
  if (!user) {
    notFound();
  }

  // 根据当前标签获取对应数据
  const [topicsData, postsData] = await Promise.all([tab === 'topics' ? getUserTopics(user.id, currentPage, LIMIT, pbnT) : {
    items: [],
    total: 0
  }, tab === 'posts' ? getUserPosts(user.id, currentPage, LIMIT, pbnT) : {
    items: [],
    total: 0
  }]);
  return <UserView user={user} initialTab={tab} initialTopics={topicsData.items} initialPosts={postsData.items} topicsTotal={topicsData.total} postsTotal={postsData.total} currentPage={currentPage} limit={LIMIT} />;
}
