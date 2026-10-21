'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import ErrorView from '@/components/common/ErrorView';
export default function RootErrorPage({
  error,
  reset
}) {
  const pbnT = usePbnTranslations();
  return <ErrorView error={error} reset={reset} logLabel={pbnT("m914")} />;
}
