import { usePbnTranslations } from '@/i18n/useTranslations';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Loader2, Search } from 'lucide-react';
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
 * @param {number} [props.minQueryLength=0] - 自动搜索最小字符数
 * @param {boolean} [props.openOnEmpty=false] - 无结果时是否打开下拉提示
 * @param {string} [props.emptyText] - 无结果时显示的文本
 * @param {string} [props.minCharsText] - 未达最小字符时的提示
 * @param {string} [props.errorText] - 搜索失败时的提示
 * @param {string} [props.clearText] - 清除按钮文本
 * @param {string} [props.className] - 容器额外样式
 * @param {boolean} [props.disabled=false]
 */
export function SearchSelect(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    value,
    onChange,
    searchFn,
    transformData = (item) => ({
      id: item.id,
      label: item.name || item.username,
      description: item.email,
    }),
    renderItem,
    renderSelected,
    label,
    placeholder = pbnT('m475'),
    autoSearch = false,
    debounceMs = 500,
    minQueryLength = 0,
    openOnEmpty = false,
    emptyText = pbnT('m1489'),
    minCharsText,
    errorText,
    clearText = pbnT('m1299'),
    className = '',
    disabled = false,
  } = pbnArgument0;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef(null);
  const requestSeq = useRef(0);

  const executeSearch = useCallback(
    async (query) => {
      const trimmed = String(query || '').trim();
      if (!trimmed) {
        requestSeq.current += 1;
        setSearchResults([]);
        setSearchError(null);
        setOpen(false);
        setHighlightedIndex(-1);
        setSearching(false);
        return;
      }
      if (trimmed.length < minQueryLength) {
        requestSeq.current += 1;
        setSearchResults([]);
        setSearchError(null);
        setOpen(Boolean(minCharsText));
        setHighlightedIndex(-1);
        setSearching(false);
        return;
      }

      const seq = ++requestSeq.current;
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchFn(trimmed);
        if (seq !== requestSeq.current) return;
        const items = Array.isArray(results) ? results : [];
        setSearchResults(items);
        setOpen(items.length > 0 || openOnEmpty);
        setHighlightedIndex(items.length > 0 ? 0 : -1);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.error('Search failed:', error);
        setSearchResults([]);
        setSearchError(error?.message || errorText || pbnT('m71'));
        setOpen(true);
        setHighlightedIndex(-1);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    },
    [searchFn, minQueryLength, openOnEmpty, minCharsText, errorText, pbnT],
  );

  useEffect(() => {
    if (!autoSearch || disabled) return;
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchQuery, autoSearch, debounceMs, executeSearch, disabled]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleManualSearch = () => {
    executeSearch(searchQuery);
  };

  const handleSelect = (item) => {
    onChange(item);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open || (searchResults.length === 0 && !searchError)) {
      if (!autoSearch && e.key === 'Enter') {
        handleManualSearch();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (searchResults.length === 0) return;
        setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (searchResults.length === 0) return;
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
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
      default:
        break;
    }
  };

  const defaultRenderItem = (item, transformed, onSelect, isHighlighted) => (
    <button
      key={transformed.id}
      type="button"
      className={cn(
        'w-full p-3 text-left transition-colors cursor-pointer',
        isHighlighted ? 'bg-accent' : 'hover:bg-muted',
      )}
      onClick={onSelect}
      onMouseEnter={() => setHighlightedIndex(searchResults.indexOf(item))}
    >
      <div className="font-medium text-sm">{transformed.label}</div>
      {transformed.description && (
        <div className="text-xs text-muted-foreground">{transformed.description}</div>
      )}
    </button>
  );

  const defaultRenderSelected = (item, transformed) => (
    <div className="flex items-center justify-between h-9 px-3 border rounded-md bg-muted">
      <span className="text-sm font-medium truncate">{transformed.label}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs shrink-0"
        onClick={handleClear}
        disabled={disabled}
      >
        {clearText}
      </Button>
    </div>
  );

  const transformedValue = value ? transformData(value) : null;
  const trimmedQuery = searchQuery.trim();
  const showMinCharsHint =
    open &&
    !searching &&
    !searchError &&
    searchResults.length === 0 &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length < minQueryLength;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}

      {value ? (
        renderSelected ? (
          renderSelected(value, transformedValue, handleClear)
        ) : (
          defaultRenderSelected(value, transformedValue)
        )
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="flex gap-2">
              {autoSearch ? (
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                    disabled={disabled}
                    autoComplete="off"
                  />
                  {searching && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ) : (
                <>
                  <Input
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    autoComplete="off"
                  />
                  <Button type="button" onClick={handleManualSearch} disabled={searching || disabled}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </PopoverAnchor>

          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] min-w-72 max-w-[calc(100vw-2rem)]"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            {searchError ? (
              <div className="p-4 text-center text-sm text-destructive">
                {errorText || searchError}
              </div>
            ) : searching ? (
              <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {pbnT('m71')}
              </div>
            ) : searchResults.length > 0 ? (
              <div ref={listRef} className="divide-y max-h-60 overflow-y-auto overscroll-contain">
                {searchResults.map((item, index) => {
                  const transformed = transformData(item);
                  const isHighlighted = index === highlightedIndex;
                  return renderItem
                    ? renderItem(item, transformed, () => handleSelect(item), isHighlighted)
                    : defaultRenderItem(item, transformed, () => handleSelect(item), isHighlighted);
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {showMinCharsHint ? minCharsText || emptyText : emptyText}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
