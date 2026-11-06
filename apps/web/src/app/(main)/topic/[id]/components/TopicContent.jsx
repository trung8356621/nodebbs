'use client';

import SeoEntitlementPanel from '@/modules/forum/components/topic/SeoEntitlementPanel';
import PaidPinPanel from '@/modules/forum/components/topic/PaidPinPanel';
import TopicAlerts from '@/modules/forum/components/topic/TopicDetail/TopicAlerts';
import TopicHeader from '@/modules/forum/components/topic/TopicDetail/TopicHeader';
import TopicMetaLine from '@/modules/forum/components/topic/TopicDetail/TopicMetaLine';
import TopicBody from '@/modules/forum/components/topic/TopicDetail/TopicBody';
import FirstPostActions from '@/modules/forum/components/topic/TopicDetail/FirstPostActions';
import { useTopicContext } from '@/modules/forum/contexts/TopicContext';
import { SeoActiveFrame, useSeoActive } from '@/modules/forum/components/topic/SeoActiveMark';

/**
 * 话题内容组件（首帖展示）
 * 默认组合：组装原子组件，保持向后兼容
 * 模板可直接使用此组件，也可单独引用原子组件自由组合
 */
export default function TopicContent() {
  const { topic } = useTopicContext();
  const seoActive = useSeoActive(topic);
  const article = (
    <>
      <div className={seoActive ? 'px-4 pt-4 pb-3 space-y-3' : 'px-4 mb-6 space-y-3'}>
        <TopicHeader />
        <TopicMetaLine />
      </div>
      <div className={seoActive ? 'border-t border-border/60' : 'content-card mb-6'} data-post-number='1'>
        <div className='px-3 sm:px-6 py-4 sm:py-5'>
          <TopicBody content={topic.content} topic={topic} />
          <div className='pt-4 mt-4 border-t border-border/50'>
            <FirstPostActions />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 提示信息 */}
      <div className='px-4 mb-4'>
        <TopicAlerts />
      </div>

      <SeoActiveFrame active={seoActive} className='mb-6 rounded-xl' innerClassName='rounded-[calc(0.75rem-3px)]'>
        {article}
      </SeoActiveFrame>

      <SeoEntitlementPanel />
      <PaidPinPanel />
    </>
  );
}
