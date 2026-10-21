'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import NotFoundView from '@/components/common/NotFoundView';
import { Search } from 'lucide-react';
export default function NotFound() {
  const pbnT = usePbnTranslations();
  return <NotFoundView icon={<Search className='h-10 w-10 text-muted-foreground/50 stroke-[1.5]' />} title={pbnT("m915")} description={pbnT("m916")} />;
}
