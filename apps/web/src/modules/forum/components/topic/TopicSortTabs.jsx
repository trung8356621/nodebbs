'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * 话题排序标签页
 * 受控模式：始终从 URL searchParams 读取当前排序值，
 * 通过 router.push 更新 URL，避免 Radix asChild + Link 导航冲突。
 */
export function TopicSortTabs({
  defaultValue = 'latest',
  className
}) {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 始终以 URL 为数据源，确保受控状态与页面一致
  const currentSort = searchParams.get('sort') || defaultValue;
  const handleValueChange = value => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    // 切换排序时重置分页到第一页
    params.delete('p');
    router.push(`${pathname}?${params.toString()}`, {
      scroll: false
    });
  };
  return <Tabs value={currentSort} onValueChange={handleValueChange} className={className}>
      <TabsList>
        <TabsTrigger value='latest'>{pbnT("m2362")}</TabsTrigger>
        <TabsTrigger value='newest'>{pbnT("m1177")}</TabsTrigger>
      </TabsList>
    </Tabs>;
}
