import { getPbnTranslations } from "@/i18n/server";
import { getTagsData } from '@/modules/forum/server';
import { TagsView } from '@/modules/forum/ui';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m80"),
    description: pbnT("m81")
  };
}
export default async function TagsPage() {
  const pbnT = await getPbnTranslations();
  const tags = await getTagsData({
    limit: 500
  }, pbnT);
  return <TagsView tags={tags} />;
}
