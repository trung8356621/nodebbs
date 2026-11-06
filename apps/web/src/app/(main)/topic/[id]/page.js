import { getPbnTranslations } from "@/i18n/server";
import { notFound } from 'next/navigation';
import { getTopicData, getPostsData } from '@/modules/forum/server';
import { getRewardEnabledStatus, getRewardStats } from '@/extensions/rewards/server';
import { getSiteInfo } from '@/lib/server/layout';
import { TopicView } from '@/modules/forum/ui';

// 生成页面元数据（SEO优化）
export async function generateMetadata({
  params
}) {
  const pbnT = await getPbnTranslations();
  const {
    id
  } = await params;

  // Sequential: avoid Promise.all([getTopicData, getSiteInfo]) which both touch
  // cookies()/React.cache and have stalled the topic App Router render.
  let topic = null;
  try {
    topic = await getTopicData(id, pbnT);
  } catch (error) {
    // 5xx / network: real error, not a soft 404 and not a 200 metadata title.
    console.error(`[topic metadata] /topics/${id}`, error);
    throw error;
  }
  // Missing, pending, or rejected (API 404 → null) must commit HTTP 404
  // before metadata returns a normal document.
  if (!topic) {
    notFound();
  }

  const {
    siteName,
    siteUrl,
    siteLogo
  } = await getSiteInfo(pbnT);

  // 提取纯文本内容作为描述（去除Markdown标记）
  const description = topic.content?.replace(/[#*`\[\]]/g, '').substring(0, 160) || '';
  const metadata = {
    title: pbnT("m120", {
      arg0: topic.title
    }),
    description,
    openGraph: {
      title: topic.title,
      description,
      type: 'article',
      siteName,
      publishedTime: topic.createdAt,
      modifiedTime: topic.updatedAt,
      authors: [topic.userName || topic.username]
    },
    twitter: {
      card: 'summary',
      title: topic.title,
      description
    }
  };

  // 有 siteUrl 时添加 URL 和图片
  if (siteUrl) {
    const ogImageUrl = siteLogo.startsWith('http') ? siteLogo : `${siteUrl}${siteLogo}`;
    metadata.openGraph.url = `${siteUrl}/topic/${id}`;
    metadata.openGraph.images = [{
      url: ogImageUrl,
      alt: siteName
    }];
    metadata.twitter.images = [ogImageUrl];
  }
  return metadata;
}

// 主页面组件（服务端组件）
export default async function TopicDetailPage({
  params,
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const {
    id
  } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.p) || 1;
  const LIMIT = 20;

  let topic;
  try {
    topic = await getTopicData(id, pbnT);
  } catch (error) {
    // Do not convert API/server failures into notFound() (fake 404).
    console.error(`[topic page] /topics/${id}`, error);
    throw error;
  }

  // API 404 (missing / pending / rejected for anonymous) → real Next 404
  if (!topic) {
    notFound();
  }

  // 优化：并行获取回复数据和积分系统状态
  const [postsData, isRewardEnabled] = await Promise.all([getPostsData(id, currentPage, LIMIT, pbnT), getRewardEnabledStatus(pbnT)]);
  const posts = postsData.items || [];
  const totalPosts = postsData.total || 0;
  const totalPages = Math.ceil(totalPosts / LIMIT);

  // 获取打赏统计（需要 posts 数据，无法并行）
  const initialRewardStats = isRewardEnabled ? await getRewardStats(topic, posts, pbnT) : {};
  return <TopicView topic={topic} initialPosts={posts} totalPosts={totalPosts} totalPages={totalPages} currentPage={currentPage} limit={LIMIT} initialRewardStats={initialRewardStats} initialIsRewardEnabled={isRewardEnabled} />;
}
