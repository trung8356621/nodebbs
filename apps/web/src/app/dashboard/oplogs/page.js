import { usePbnTranslations } from "@/i18n/useTranslations";
import { getPbnTranslations } from "@/i18n/server";
import { PageHeader } from '@/components/common/PageHeader';
import { OperationLogs } from './components/OperationLogs';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m387")
  };
}
export default function OperationLogsPage() {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m387")} description={pbnT("m388")} />
      <OperationLogs />
    </div>;
}
