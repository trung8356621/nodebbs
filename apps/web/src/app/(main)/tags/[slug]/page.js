import { getPbnTranslations } from "@/i18n/server";
import { getTopicsData, getTagData } from '@/modules/forum/server';
import { TagNotFoundView, TagView } from '@/modules/forum/ui';

// 生成页面元数据
export async function generateMetadata({
  params
}) {
  const pbnT = await getPbnTranslations();
  const resolvedParams = await params;
  const tag = await getTagData(resolvedParams.slug, pbnT);
  if (!tag) {
    return {
      title: pbnT("m82")
    };
  }
  return {
    title: pbnT("m83", {
      arg0: tag.name
    }),
    description: tag.description || pbnT("m84", {
      arg0: tag.name
    })
  };
}
export default async function TagTopicListPage({
  params,
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.p) || 1;
  const sort = resolvedSearchParams.sort || 'latest';
  const LIMIT = 50;
  const slug = resolvedParams.slug;
  const [tag, data] = await Promise.all([getTagData(slug, pbnT), getTopicsData({
    page,
    sort,
    limit: LIMIT,
    tag: slug
  }, pbnT)]);
  if (!tag) {
    return <TagNotFoundView />;
  }
  const totalPages = Math.ceil(data.total / LIMIT);
  return <TagView tag={tag} sort={sort} data={data} page={page} totalPages={totalPages} limit={LIMIT} />;
}
