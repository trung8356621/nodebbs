'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Archive, AlertCircle } from 'lucide-react';
import { useTopicContext } from '@/modules/forum/contexts/TopicContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 话题提示信息（已删除/审核未通过）
 * 原子组件，无外层布局样式
 */
export default function TopicAlerts() {
  const pbnT = usePbnTranslations();
  const {
    topic
  } = useTopicContext();
  const {
    user
  } = useAuth();
  return <>
      {topic.isDeleted && <div className='bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3'>
          <Archive className='h-5 w-5 text-destructive shrink-0 mt-0.5' />
          <div className='flex-1'>
            <p className='text-sm font-medium text-destructive mb-1'>{pbnT("m2336")}</p>
            <p className='text-xs text-muted-foreground'>{pbnT("m2337")}</p>
          </div>
        </div>}

      {topic.approvalStatus === 'rejected' && user?.id === topic.userId && <div className='bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3'>
          <AlertCircle className='h-5 w-5 text-destructive shrink-0 mt-0.5' />
          <div className='flex-1'>
            <p className='text-sm font-medium text-destructive mb-1'>{pbnT("m2338")}</p>
            <p className='text-xs text-muted-foreground'>{pbnT("m2339")}</p>
          </div>
        </div>}
    </>;
}
