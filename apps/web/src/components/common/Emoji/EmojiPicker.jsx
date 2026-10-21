'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useEmoji } from './EmojiProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, X, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

// 搜索防抖 hook
function useDebouncedValue(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function EmojiPicker({
  onSelect,
  className
}) {
  const pbnT = usePbnTranslations();
  const {
    groups,
    loading
  } = useEmoji();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [hoveredEmoji, setHoveredEmoji] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 150);
  const searchInputRef = useRef(null);

  // 初始化默认激活分组
  useEffect(() => {
    if (groups.length > 0 && !activeTab) {
      setActiveTab(groups[0].slug);
    }
  }, [groups, activeTab]);

  // 根据搜索关键词过滤表情（防抖后触发）
  const filteredGroups = useMemo(() => {
    if (!debouncedSearch.trim()) return groups;
    const lowerSearch = debouncedSearch.toLowerCase();
    return groups.map(group => ({
      ...group,
      emojis: group.emojis?.filter(emoji => emoji.code.toLowerCase().includes(lowerSearch) || emoji.name && emoji.name.toLowerCase().includes(lowerSearch)) || []
    })).filter(group => group.emojis.length > 0);
  }, [groups, debouncedSearch]);

  // 当前显示的分组
  const currentGroup = useMemo(() => {
    if (debouncedSearch) return null;
    return groups.find(g => g.slug === activeTab);
  }, [groups, activeTab, debouncedSearch]);

  // 处理表情选择
  const handleSelect = useCallback((groupSlug, code) => {
    onSelect(`${groupSlug}/${code}`);
  }, [onSelect]);

  // 打开搜索
  const openSearch = useCallback(() => {
    setSearching(true);
    // 下一帧聚焦输入框
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  // 关闭搜索
  const closeSearch = useCallback(() => {
    setSearch('');
    setSearching(false);
  }, []);
  if (loading) {
    return <div className={cn("flex flex-col h-80 w-95 items-center justify-center", className)}>
        <Smile className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
        <span className="text-sm text-muted-foreground mt-2">{pbnT("m1281")}</span>
      </div>;
  }
  if (groups.length === 0) {
    return <div className={cn("flex flex-col h-80 w-95 items-center justify-center", className)}>
        <Smile className="h-8 w-8 text-muted-foreground/30" />
        <span className="text-sm text-muted-foreground mt-2">{pbnT("m1282")}</span>
      </div>;
  }
  return <div className={cn("flex flex-col h-80 w-95 bg-popover rounded-lg overflow-hidden", className)}>
      {/* 顶部栏：分组标签 + 搜索入口，搜索时切换为搜索输入框 */}
      <div className="flex items-center border-b bg-muted/20 overflow-hidden">
        {searching ? <div className="flex items-center flex-1 px-2 py-1.5 gap-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input ref={searchInputRef} placeholder={pbnT("m1283")} className="h-7 border-0 shadow-none bg-transparent focus-visible:ring-0 px-1 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={closeSearch} className="p-1 rounded-full hover:bg-muted transition-colors shrink-0">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div> : <>
            <div className="flex flex-1 overflow-x-auto scrollbar-none">
              {groups.map(group => <button key={group.slug} onClick={() => setActiveTab(group.slug)} className={cn("shrink-0 px-4 py-2.5 text-sm font-medium transition-all relative", "hover:bg-muted/50", activeTab === group.slug ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {group.name}
                  <span className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-200", activeTab === group.slug ? "w-6 opacity-100" : "w-0 opacity-0")} />
                </button>)}
            </div>
            <button onClick={openSearch} className="shrink-0 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title={pbnT("m1284")}>
              <Search className="h-4 w-4" />
            </button>
          </>}
      </div>

      {/* 表情网格区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {debouncedSearch ? filteredGroups.length > 0 ? <div className="space-y-4">
                {filteredGroups.map(group => <div key={group.id}>
                    <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                      {group.name}
                      <span className="ml-1 text-muted-foreground/60">({group.emojis.length})</span>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {group.emojis.map(emoji => <EmojiButton key={emoji.id} emoji={emoji} groupSlug={group.slug} groupSize={group.size} onSelect={handleSelect} onHover={setHoveredEmoji} />)}
                    </div>
                  </div>)}
              </div> : <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-sm">{pbnT("m1285")}</span>
                <span className="text-xs mt-1 opacity-60">{pbnT("m1286")}</span>
              </div> : currentGroup && <div className="grid grid-cols-8 gap-1">
                {currentGroup.emojis?.map(emoji => <EmojiButton key={emoji.id} emoji={emoji} groupSlug={currentGroup.slug} groupSize={currentGroup.size} onSelect={handleSelect} onHover={setHoveredEmoji} />)}
              </div>}
        </div>
      </ScrollArea>

      {/* 底部预览栏 */}
      <div className="h-10 border-t bg-muted/20 px-3 flex items-center relative">
        {hoveredEmoji ? <div className="flex items-center gap-2 text-sm">
            <img src={hoveredEmoji.url} alt={hoveredEmoji.code} className="inline-block shrink-0 absolute bottom-1 pointer-events-none" style={{
          width: hoveredEmoji.groupSize || 24,
          height: hoveredEmoji.groupSize || 24
        }} draggable={false} />
            <span className="text-muted-foreground font-mono text-xs truncate" style={{
          marginLeft: (hoveredEmoji.groupSize || 24) + 8
        }}>
              {hoveredEmoji.groupSlug}/{hoveredEmoji.code}
            </span>
          </div> : <span className="text-xs text-muted-foreground/60">
            {currentGroup ? pbnT("m1287", {
          arg0: currentGroup.name,
          arg1: currentGroup.emojis?.length || 0
        }) : pbnT("m1288")}
          </span>}
      </div>
    </div>;
}

// 表情按钮组件（memo 避免 hoveredEmoji 变化时全量重渲染）
const EmojiButton = memo(function EmojiButton({
  emoji,
  groupSlug,
  groupSize,
  onSelect,
  onHover
}) {
  return <button className={cn("aspect-square rounded-lg flex items-center justify-center", "hover:bg-accent hover:scale-110 active:scale-95", "transition-all duration-150 ease-out", "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1")} onClick={() => onSelect(groupSlug, emoji.code)} onMouseEnter={() => onHover({
    ...emoji,
    groupSlug,
    groupSize
  })} onMouseLeave={() => onHover(null)}>
      <img src={emoji.url} alt={emoji.code} className="inline-block select-none" style={{
      width: 28,
      height: 28
    }} loading="lazy" draggable={false} />
    </button>;
});
