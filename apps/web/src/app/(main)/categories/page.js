import { getPbnTranslations } from "@/i18n/server";
import { getCategoriesTree } from '@/modules/forum/server';
import { CategoriesView } from '@/modules/forum/ui';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m44"),
    description: pbnT("m45")
  };
}
export default async function CategoriesPage() {
  const pbnT = await getPbnTranslations();
  const categories = await getCategoriesTree(pbnT);
  return <CategoriesView categories={categories} />;
}
