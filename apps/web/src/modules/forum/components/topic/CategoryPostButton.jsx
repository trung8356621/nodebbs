'use client';
import {usePbnTranslations} from '@/i18n/useTranslations';
import Link from '@/components/common/Link';
import {Button} from '@/components/ui/button';
import {Plus} from 'lucide-react';
export default function CategoryPostButton({categoryId}) {
  const t=usePbnTranslations();
  return <Button asChild className="shrink-0 w-full sm:w-auto"><Link href={'/create?categoryId='+categoryId} data-testid="category-post"><Plus className="h-4 w-4"/>{t('postingLocal')}</Link></Button>;
}
