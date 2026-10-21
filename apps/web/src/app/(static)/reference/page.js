import { getPbnTranslations } from "@/i18n/server";
import ScalarAPI from '@/components/common/ScalarAPI';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m161"),
    description: pbnT("m204")
  };
}
export default function ApiReference() {
  const url = `/docs/json`;
  const config = {
    url,
    theme: 'alternate',
    customCss: `.scalar-app .h-dvh{height: calc(100dvh - 58px); top: 58px}`,
    defaultHttpClient: {
      targetKey: 'node',
      clientKey: 'fetch'
    }
  };
  return <ScalarAPI config={config} />;
}
