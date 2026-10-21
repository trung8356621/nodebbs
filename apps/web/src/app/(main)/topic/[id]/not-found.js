'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import NotFoundView from '@/components/common/NotFoundView';
import { MessageSquareOff } from 'lucide-react';
export default function NotFound() {
  const pbnT = usePbnTranslations();
  return <NotFoundView icon={<MessageSquareOff className='h-10 w-10 text-muted-foreground/50 stroke-[1.5]' />} title={pbnT("m118")} description={pbnT("m119")} />;
}
