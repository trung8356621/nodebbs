'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, Check, Plus, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 通用多选组件
 *
 * @param {Array} value - 选中的值数组
 * @param {Function} onChange - 值变化回调
 * @param {Array} options - 选项列表 [{ value, label, ...extra }]
 * @param {string} placeholder - 占位文本
 * @param {string} searchPlaceholder - 搜索框占位文本
 * @param {boolean} disabled - 是否禁用
 * @param {Function} renderOption - 自定义选项渲染 (option) => ReactNode
 * @param {Function} renderBadge - 自定义 Badge 渲染 (option, onRemove) => ReactNode
 * @param {Function} onSearch - 异步搜索回调，传入时禁用本地过滤
 * @param {boolean} loading - 加载状态
 * @param {number} maxCount - 最大选择数量
 * @param {Function} onCreate - 创建新选项回调 (query: string) => void
 */
export default function MultiSelect(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    value = [],
    onChange,
    options = [],
    placeholder = pbnT("m1427"),
    searchPlaceholder = pbnT("m475"),
    disabled = false,
    renderOption,
    renderBadge,
    onSearch,
    loading = false,
    maxCount,
    onCreate
  } = pbnArgument0;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const isAsync = !!onSearch;
  const isMaxed = maxCount != null && value.length >= maxCount;
  const selectedSet = new Set(value);
  const handleSelect = selectedValue => {
    if (selectedSet.has(selectedValue)) {
      onChange(value.filter(v => v !== selectedValue));
    } else if (!isMaxed) {
      onChange([...value, selectedValue]);
    }
  };
  const handleRemove = removedValue => {
    onChange(value.filter(v => v !== removedValue));
  };
  const handleSearchChange = query => {
    setSearch(query);
    if (onSearch) {
      onSearch(query);
    }
  };
  const handleOpenChange = nextOpen => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
    }
  };

  // 创建选项逻辑
  const trimmedSearch = search.trim();
  const hasExactMatch = options.some(opt => opt.label.toLowerCase() === trimmedSearch.toLowerCase());
  const showCreateOption = onCreate && trimmedSearch && !hasExactMatch && !isMaxed;
  const handleCreate = () => {
    if (trimmedSearch && !isMaxed) {
      onCreate(trimmedSearch);
      setSearch('');
    }
  };
  const getOption = useCallback(val => {
    return options.find(o => o.value === val);
  }, [options]);
  const getLabel = useCallback(val => {
    return getOption(val)?.label || String(val);
  }, [getOption]);

  // 触发器文案
  const triggerText = isMaxed ? pbnT("m1428", {
    arg0: maxCount
  }) : value.length > 0 ? pbnT("m1429", {
    arg0: value.length
  }) : placeholder;
  return <div className="space-y-2">
      {value.length > 0 && <div className="flex flex-wrap gap-1">
          {value.map(v => {
        const opt = getOption(v);
        if (renderBadge) {
          return <span key={v}>
                  {renderBadge(opt || {
              value: v,
              label: String(v)
            }, () => handleRemove(v))}
                </span>;
        }
        return <Badge key={v} variant="secondary" className="text-xs px-1.5 py-0.5 h-6 gap-1">
                {getLabel(v)}
                <button type="button" className="ml-0.5 rounded-full hover:bg-muted-foreground/20" onClick={() => handleRemove(v)} disabled={disabled}>
                  <X className="h-3 w-3 hover:text-destructive" />
                </button>
              </Badge>;
      })}
        </div>}

      <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
        <PopoverTrigger asChild disabled={disabled || isMaxed}>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9 font-normal">
            <span className="text-muted-foreground">{triggerText}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={!isAsync}>
            <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={handleSearchChange} />
            <CommandList>
              {loading ? <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div> : <>
                  {options.length === 0 && !showCreateOption && <CommandEmpty>{pbnT("m1430")}</CommandEmpty>}
                  {options.length > 0 && <CommandGroup>
                      {options.map(opt => {
                  const isSelected = selectedSet.has(opt.value);
                  return <CommandItem key={opt.value} value={opt.label} onSelect={() => handleSelect(opt.value)} disabled={isMaxed && !isSelected}>
                            <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                            {renderOption ? renderOption(opt) : opt.label}
                          </CommandItem>;
                })}
                    </CommandGroup>}
                  {showCreateOption && <CommandGroup>
                      <CommandItem onSelect={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span>{pbnT("m1431")}<strong>{trimmedSearch}</strong>
                        </span>
                      </CommandItem>
                    </CommandGroup>}
                </>}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>;
}
