import { usePbnTranslations } from "@/i18n/useTranslations";
import NotFoundView from '@/components/common/NotFoundView';
import { Tag } from 'lucide-react';
import SidebarLayout from '../layouts/SidebarLayout';

/**
 * 标签不存在页面
 */
export default function TagNotFoundView() {
  const pbnT = usePbnTranslations();
  return <SidebarLayout>
      <NotFoundView icon={<Tag className='h-10 w-10 text-muted-foreground/50 stroke-[1.5]' />} title={pbnT("m82")} description={pbnT("m2467")} />
    </SidebarLayout>;
}
