import { usePbnTranslations } from "@/i18n/useTranslations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { SearchTopicsTab } from './SearchTopicsTab';
import { SearchPostsTab } from './SearchPostsTab';
import { SearchUsersTab } from './SearchUsersTab';

/**
 * 搜索页面内容组件
 * 简洁设计：无标题头部、懒加载 Tab
 */
export function SearchContent({
  searchQuery,
  searchType,
  onSearchTypeChange,
  loading,
  searchResults,
  onLoadPage
}) {
  const pbnT = usePbnTranslations();
  // 空搜索状态
  if (!searchQuery) {
    return <div className='text-center py-20 mx-3 sm:mx-0 card-base'>
        <Search className='h-16 w-16 text-muted-foreground/50 mx-auto mb-4' />
        <div className='text-xl font-medium text-foreground mb-2'>{pbnT("m66")}</div>
        <p className='text-sm text-muted-foreground max-w-md mx-auto'>{pbnT("m67")}</p>
      </div>;
  }
  return <div className='space-y-3'>
      <Tabs value={searchType} onValueChange={onSearchTypeChange} className='gap-3'>
        <TabsList className='mx-3 sm:mx-0'>
          <TabsTrigger value='topics'>{pbnT("m68")}</TabsTrigger>
          <TabsTrigger value='posts'>{pbnT("m69")}</TabsTrigger>
          <TabsTrigger value='users'>{pbnT("m70")}</TabsTrigger>
        </TabsList>

        <TabsContent value='topics'>
          <SearchTopicsTab loading={loading} results={searchResults} onLoadPage={onLoadPage} searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value='posts'>
          <SearchPostsTab loading={loading} results={searchResults} onLoadPage={onLoadPage} searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value='users'>
          <SearchUsersTab loading={loading} results={searchResults} onLoadPage={onLoadPage} searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>;
}
