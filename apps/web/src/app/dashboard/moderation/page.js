'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PendingContent } from './components/PendingContent';
import { moderationApi } from '@/lib/api';
import { toast } from 'sonner';
export default function ContentModerationPage() {
  const pbnT = usePbnTranslations();
  const [activeTab, setActiveTab] = useState('all');
  const [status, setStatus] = useState('pending');
  const [stat, setStat] = useState({
    total: 0,
    byType: {},
    types: []
  });
  useEffect(() => {
    loadStat();
  }, []);
  const loadStat = async () => {
    try {
      const data = await moderationApi.getQueueStat();
      setStat({
        total: data.total || 0,
        byType: data.byType || {},
        types: data.types || []
      });
    } catch (error) {
      console.error('Failed to load moderation stat:', error);
      toast.error(pbnT("m377"));
    }
  };
  const types = stat.types;
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m180")} description={pbnT("m378")} />

      {/* 待审核汇总（紧凑单行：总计 + 非空类型，取代占位较多的统计卡网格） */}
      <div className='flex items-center gap-2 flex-wrap text-sm text-muted-foreground'>
        <span className='flex items-center gap-1.5 font-medium text-foreground'>
          <Clock className='h-4 w-4 text-yellow-500' />{pbnT("m379")}{" "}{stat.total}
        </span>
        {types.filter(t => (stat.byType?.[t.type] || 0) > 0).map(t => <span key={t.type}>
              · {t.label} {stat.byType[t.type]}
            </span>)}
      </div>

      {/* 审核队列 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className='flex items-center justify-between gap-4 flex-wrap'>
          <TabsList>
            <TabsTrigger value='all'>{pbnT("m307")}</TabsTrigger>
            {types.map(t => <TabsTrigger key={t.type} value={t.type}>
                {t.label}
              </TabsTrigger>)}
          </TabsList>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='pending'>{pbnT("m379")}</SelectItem>
              <SelectItem value='approved'>{pbnT("m369")}</SelectItem>
              <SelectItem value='rejected'>{pbnT("m370")}</SelectItem>
              <SelectItem value='all'>{pbnT("m307")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab} className='space-y-4 mt-6'>
          <PendingContent type={activeTab} status={status} onModerationComplete={loadStat} />
        </TabsContent>
      </Tabs>
    </div>;
}
