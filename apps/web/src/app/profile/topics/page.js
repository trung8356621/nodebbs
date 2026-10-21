'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { CreatedTopics } from './components/CreatedTopics';
import { FavoriteTopics } from './components/FavoriteTopics';
export default function MyTopicsPage() {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 获取当前 Tab，默认为 'created'
  const currentTab = searchParams.get('tab') || 'created';
  const handleTabChange = value => {
    const params = new URLSearchParams(searchParams);
    if (value === 'created') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    router.push(`/profile/topics?${params.toString()}`);
  };
  return <div className='space-y-4'>
      <PageHeader title={pbnT("m1193")} description={pbnT("m1194")} />
      <Tabs defaultValue='created' value={currentTab} onValueChange={handleTabChange}>
        <TabsList className='grid grid-cols-2 mb-2'>
          <TabsTrigger value='created'>{pbnT("m1195")}</TabsTrigger>
          <TabsTrigger value='favorites'>{pbnT("m1196")}</TabsTrigger>
        </TabsList>

        <TabsContent value='created' className='mt-0'>
          <CreatedTopics />
        </TabsContent>

        <TabsContent value='favorites' className='mt-0'>
          <FavoriteTopics />
        </TabsContent>
      </Tabs>
    </div>;
}
