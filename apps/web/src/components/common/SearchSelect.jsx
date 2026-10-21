import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 通用搜索选择组件
 * 
 * @param {Object} props
 * @param {any} props.value - 当前选中的值
 * @param {Function} props.onChange - 值变化时的回调
 * @param {Function} props.searchFn - 搜索函数，接收 query 返回 Promise<Array>
 * @param {Function} [props.transformData] - 数据转换函数，将搜索结果转为 { id, label, description? } 格式
 * @param {Function} [props.renderItem] - 自定义渲染搜索结果项
 * @param {Function} [props.renderSelected] - 自定义渲染已选中状态
 * @param {string} [props.label] - 标签文本
 * @param {string} [props.placeholder] - 输入框 placeholder
 * @param {boolean} [props.autoSearch=false] - 是否自动搜索（输入时防抖搜索）
 * @param {number} [props.debounceMs=500] - 防抖延迟（毫秒）
 * @param {string} [props.emptyText] - 无结果时显示的文本
 * @param {string} [props.clearText] - 清除按钮文本
 * @param {string} [props.className] - 容器额外样式
 */
export function SearchSelect(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    value,
    onChange,
    searchFn,
    transformData = item => ({
      id: item.id,
      label: item.name || item.username,
      description: item.email
    }),
    renderItem,
    renderSelected,
    label,
    placeholder = pbnT("m475"),
    autoSearch = false,
    debounceMs = 500,
    emptyText = pbnT("m1489"),
    clearText = pbnT("m1299"),
    className = ''
  } = pbnArgument0;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef(null);

  // 执行搜索
  const executeSearch = useCallback(async query => {
    if (!query.trim()) {
      setSearchResults([]);
      setOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    setSearching(true);
    try {
      const results = await searchFn(query);
      const items = Array.isArray(results) ? results : [];
      setSearchResults(items);
      setOpen(items.length > 0);
      setHighlightedIndex(items.length > 0 ? 0 : -1);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchFn]);

  // 自动搜索模式：防抖
  useEffect(() => {
    if (!autoSearch) return;
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchQuery, autoSearch, debounceMs, executeSearch]);

  // 高亮项滚动到可视区域
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          block: 'nearest'
        });
      }
    }
  }, [highlightedIndex]);

  // 手动搜索
  const handleManualSearch = () => {
    executeSearch(searchQuery);
  };

  // 选中项
  const handleSelect = item => {
    onChange(item);
    setSearchResults([]);
    setSearchQuery('');
    setOpen(false);
    setHighlightedIndex(-1);
  };

  // 清除选中
  const handleClear = () => {
    onChange(null);
  };

  // 键盘事件处理
  const handleKeyDown = e => {
    if (!open || searchResults.length === 0) {
      // 手动模式：Ente r触发搜索
      if (!autoSearch && e.key === 'Enter') {
        handleManualSearch();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelect(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // 默认渲染搜索结果项
  const defaultRenderItem = (item, transformed, onSelect, isHighlighted) => <button key={transformed.id} className={cn("w-full p-3 text-left transition-colors cursor-pointer", isHighlighted ? "bg-accent" : "hover:bg-muted")} onClick={onSelect} onMouseEnter={() => setHighlightedIndex(searchResults.indexOf(item))}>
      <div className="font-medium text-sm">{transformed.label}</div>
      {transformed.description && <div className="text-xs text-muted-foreground">{transformed.description}</div>}
    </button>;

  // 默认渲染已选中状态
  const defaultRenderSelected = (item, transformed) => <div className="flex items-center justify-between h-9 px-3 border rounded-md bg-muted">
      <span className="text-sm font-medium truncate">{transformed.label}</span>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0" onClick={handleClear}>
        {clearText}
      </Button>
    </div>;
  const transformedValue = value ? transformData(value) : null;
  return <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      
      {value ?
    // 已选中状态
    renderSelected ? renderSelected(value, transformedValue, handleClear) : defaultRenderSelected(value, transformedValue) :
    // 搜索输入状态
    <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="flex gap-2">
              {autoSearch ?
          // 自动搜索模式：带图标的输入框
          <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={placeholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleKeyDown} className="pl-9" />
                  {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div> :
          // 手动搜索模式：输入框 + 搜索按钮
          <>
                  <Input placeholder={placeholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleKeyDown} />
                  <Button onClick={handleManualSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </>}
            </div>
          </PopoverAnchor>
          
          <PopoverContent className="p-0 w-72 max-w-[calc(100vw-2rem)]" align="start" onOpenAutoFocus={e => e.preventDefault()} onWheel={e => e.stopPropagation()}>
            {searchResults.length > 0 ? <div ref={listRef} className="divide-y max-h-48 overflow-y-auto overscroll-contain">
                {searchResults.map((item, index) => {
            const transformed = transformData(item);
            const isHighlighted = index === highlightedIndex;
            return renderItem ? renderItem(item, transformed, () => handleSelect(item), isHighlighted) : defaultRenderItem(item, transformed, () => handleSelect(item), isHighlighted);
          })}
              </div> : <div className="p-4 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>}
          </PopoverContent>
        </Popover>}
    </div>;
}
