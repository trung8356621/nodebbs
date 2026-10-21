import { getPbnTranslations } from "@/i18n/server";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { getTopicsData } from '@/modules/forum/server';
import { HomeView } from '@/modules/forum/ui';

// 页面标题映射
const PAGE_OPTS = (pbnT = pbnRuntimeT) => ({
  latest: {
    title: pbnT("m56"),
    description: pbnT("m57")
  },
  newest: {
    title: pbnT("m58"),
    description: pbnT("m59")
  },
  popular: {
    title: pbnT("m60"),
    description: pbnT("m61")
  },
  trending: {
    title: pbnT("m62"),
    description: pbnT("m63")
  }
});

// 生成页面元数据（SEO优化）
export async function generateMetadata({
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const resolvedParams = await searchParams;
  const sort = resolvedParams.sort || 'latest';
  const {
    title
  } = PAGE_OPTS(pbnT)[sort] || PAGE_OPTS(pbnT).latest;
  return {
    openGraph: {
      title,
      type: 'website'
    }
  };
}

// 主页面组件（服务端组件）
export default async function HomePage({
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.p) || 1;
  const sort = resolvedParams.sort || 'latest';
  const LIMIT = 50;
  const {
    title,
    description
  } = PAGE_OPTS(pbnT)[sort] || PAGE_OPTS(pbnT).latest;
  const data = await getTopicsData({
    page,
    sort,
    limit: LIMIT
  }, pbnT);
  const totalPages = Math.ceil(data.total / LIMIT);
  return <HomeView title={title} description={description} sort={sort} data={data} page={page} totalPages={totalPages} limit={LIMIT} />;
}
