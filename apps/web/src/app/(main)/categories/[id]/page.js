import { getPbnTranslations } from "@/i18n/server";
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getTopicsData } from '@/modules/forum/server';
import { CategoryView } from '@/modules/forum/ui';

// 生成页面元数据
export async function generateMetadata({
  params
}) {
  const pbnT = await getPbnTranslations();
  const {
    id: slug
  } = await params;
  const category = await getCategoryBySlug(slug, pbnT);
  if (!category) {
    return {
      title: pbnT("m46")
    };
  }
  return {
    title: `${category.name}`,
    description: category.description || pbnT("m47", {
      arg0: category.name
    }),
    openGraph: {
      title: category.name,
      description: category.description || pbnT("m47", {
        arg0: category.name
      }),
      type: 'website'
    }
  };
}
export default async function CategoryPage({
  params,
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const {
    id: slug
  } = await params;
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.p) || 1;
  const sort = resolvedParams.sort || 'latest';
  const LIMIT = 20;
  const category = await getCategoryBySlug(slug, pbnT);
  if (!category) {
    notFound();
  }
  const data = await getTopicsData({
    page,
    sort,
    categoryId: category.id,
    limit: LIMIT
  }, pbnT);
  const totalPages = Math.ceil(data.total / LIMIT);
  return <CategoryView category={category} sort={sort} data={data} page={page} totalPages={totalPages} limit={LIMIT} />;
}
