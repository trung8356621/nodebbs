import { getPbnTranslations } from "@/i18n/server";
import CreateTopicContent from './components/CreateTopicContent';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m54"),
    description: pbnT("m55")
  };
}
export default function CreateTopic() {
  return <CreateTopicContent />;
}
