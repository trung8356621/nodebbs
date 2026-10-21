import { getPbnTranslations } from "@/i18n/server";
import AboutContent from './components/AboutContent';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m202"),
    description: pbnT("m203")
  };
}
export default function AboutPage() {
  return <AboutContent />;
}
