'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Inbox, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pager } from './Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

// 自定义 Table 包装器，移除默认的滚动容器以支持 sticky 列
function TableWrapper({
  className,
  children,
  ...props
}) {
  return <div className='relative w-full overflow-x-auto custom-scrollbar'>
      <table className={cn('w-full caption-bottom text-sm', className)} {...props}>
        {children}
      </table>
    </div>;
}

/**
 * 通用数据表格组件 - Pro Max Version
 * @param {Object} props
 * @param {Array} props.columns - 列配置 [{ key, label, width, render, align, sticky }]
 *   - sticky: 'left' | 'right' 固定列位置
 * @param {Array} props.data - 数据数组
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.pagination - 分页配置 { page, total, limit, onPageChange }
 * @param {Object} props.search - 搜索配置 { value, onChange, placeholder }
 * @param {Object} props.filter - 单个过滤配置 { value, onChange, options, label?, width? }
 * @param {Array} props.filters - 多个过滤配置 [{ value, onChange, options, label?, width? }]
 * @param {string} props.emptyMessage - 空数据提示
 * @param {Function} props.onRowClick - 行点击事件
 * @param {Object} props.selection - 选择配置 { selectedIds: Set, onSelectionChange: (Set) => void, rowIdKey?: string }
 * @param {Array} props.batchActions - 批量操作 [{ label, icon, variant, onClick, disabled?, hidden?, loading? }]
 */
export function DataTable(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    columns = [],
    data = [],
    loading = false,
    pagination,
    search,
    filter,
    filters,
    emptyMessage = pbnT("m1272"),
    onRowClick,
    selection,
    batchActions = []
  } = pbnArgument0;
  // 向后兼容：如果传入 filter 但没有 filters，将其转换为 filters 数组
  const filterList = filters || (filter ? [filter] : []);
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  // === 多选相关派生状态 ===
  const selectionEnabled = !!selection;
  const rowIdKey = selection?.rowIdKey || 'id';
  const selectedIds = selection?.selectedIds || new Set();
  const onSelectionChange = selection?.onSelectionChange;
  const currentPageIds = selectionEnabled ? data.map(row => row[rowIdKey]) : [];
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const someOnPageSelected = !allOnPageSelected && currentPageIds.some(id => selectedIds.has(id));
  const visibleBatchActions = batchActions.filter(action => !action.hidden);

  // === 选择处理函数 ===
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      currentPageIds.forEach(id => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      currentPageIds.forEach(id => next.add(id));
      onSelectionChange(next);
    }
  };
  const handleSelectRow = rowId => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    onSelectionChange(next);
  };
  const handleDeselectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  };

  // === 自动插入 Checkbox 列 ===
  const checkboxColumn = {
    key: '__selection',
    width: 'w-[40px]',
    sticky: 'left',
    label: <Checkbox checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false} onCheckedChange={handleSelectAll} disabled={loading || data.length === 0} aria-label={pbnT("m1273")} />,
    render: (_, row) => {
      const rowId = row[rowIdKey];
      return <Checkbox checked={selectedIds.has(rowId)} onCheckedChange={() => handleSelectRow(rowId)} onClick={e => e.stopPropagation()} disabled={loading} aria-label={pbnT("m1274", {
        arg0: rowId
      })} />;
    }
  };
  const effectiveColumns = selectionEnabled ? [checkboxColumn, ...columns] : columns;

  // 获取列的样式（包括固定定位）
  const getColumnStyle = column => {
    const style = {};
    if (column.align) {
      style.textAlign = column.align;
    }
    if (column.sticky) {
      // sticky 列默认使用最小内容宽度（除非显式设置了 width）
      if (!column.width) {
        style.width = '1%';
      }
      if (column.sticky === 'left') {
        // checkbox 列存在时，其他 sticky left 列偏移 40px
        if (selectionEnabled && column.key !== '__selection') {
          style.left = '40px';
        } else {
          style.left = '0';
        }
        style.zIndex = 20;
      } else if (column.sticky === 'right') {
        style.right = '0';
        style.zIndex = 20;
      }
    }
    return style;
  };

  // 获取列的类名
  const getColumnClassName = (column, isHeader = false) => {
    const classes = [column.width, 'transition-colors'];
    if (column.sticky) {
      classes.push('sticky');

      // 背景色 - 使用 backdrop-blur 实现毛玻璃效果，但为了 sticky 需要有背景色
      if (isHeader) {
        classes.push('bg-muted/90 backdrop-blur-sm supports-[backdrop-filter]:bg-muted/60');
      } else {
        classes.push('bg-card/90 backdrop-blur-sm supports-[backdrop-filter]:bg-card/60 group-hover:bg-accent/90 group-data-[state=selected]:bg-primary/5 transition-colors');
      }

      // 边框
      if (column.sticky === 'left') {
        classes.push('border-r border-border/50');
      } else if (column.sticky === 'right') {
        classes.push('border-l border-border/50');
      }
    }
    return classes.filter(Boolean).join(' ');
  };
  return <div className='space-y-4'>
      {/* 搜索和过滤栏 */}
      {(search || filterList.length > 0) && <div className='flex flex-col sm:flex-row gap-4 p-1'>
          {search && <div className='flex-1'>
              <div className='relative group'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors' />
                <Input placeholder={search.placeholder || pbnT("m475")} value={search.value} onChange={e => search.onChange(e.target.value)} className='pl-9 bg-background/50 border-muted-foreground/20 focus:border-primary/50 focus:ring-primary/20 transition-all hover:bg-background/80' />
              </div>
            </div>}
          {filterList.map((filterItem, index) => <div key={index} className={filterItem.width || 'w-full sm:w-45'}>
              {filterItem.label && <label className='text-xs font-medium text-muted-foreground mb-1.5 block ml-1'>
                  {filterItem.label}
                </label>}
              <Select value={filterItem.value} onValueChange={filterItem.onChange}>
                <SelectTrigger className='w-full bg-background/50 border-muted-foreground/20 hover:bg-background/80 transition-all'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterItem.options.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>)}
        </div>}

      {/* 表格容器 */}
      <div className='relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden transition-all hover:border-border/80'>

        {/* 批量操作栏 - 内嵌在表格容器顶部，使用 grid-rows 实现平滑展开/收起 */}
        {selectionEnabled && visibleBatchActions.length > 0 && <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out", selectedIds.size > 0 ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-primary/5 border-b border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{pbnT("m1275")}<span className="text-primary font-semibold">{selectedIds.size}</span>{pbnT("m1276")}</span>
                  <Button variant="ghost" size="sm" onClick={handleDeselectAll} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />{pbnT("m1277")}</Button>
                </div>
                <div className="flex items-center gap-2">
                  {visibleBatchActions.map((action, index) => <Button key={index} variant={action.variant || 'outline'} size="sm" onClick={e => action.onClick(selectedIds, e)} disabled={action.disabled || action.loading} className="h-7 text-xs">
                      {action.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.icon ? <action.icon className="h-3.5 w-3.5" /> : null}
                      {action.label}
                    </Button>)}
                </div>
              </div>
            </div>
          </div>}

        {/* Loading Overlay - 仅在非初始加载（已有数据）时显示 */}
        {loading && data.length > 0 && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px] transition-all duration-300">
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background/80 animate-in fade-in zoom-in-95 duration-200">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="text-xs font-medium text-muted-foreground">{pbnT("m71")}</span>
            </div>
          </div>}

        <TableWrapper>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b border-border/50">
              {effectiveColumns.map(column => <TableHead key={column.key} className={cn('h-12 text-xs uppercase tracking-wider font-semibold text-muted-foreground', getColumnClassName(column, true))} style={getColumnStyle(column)}>
                  {column.label}
                </TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ?
          // Skeleton Loading State - 仅在初始加载（无数据）时显示
          Array.from({
            length: Math.max(pagination?.limit || 5, 5)
          }).map((_, rowIndex) => <TableRow key={`skeleton-${rowIndex}`} className="border-b border-border/40 hover:bg-transparent">
                  {effectiveColumns.map((column, colIndex) => <TableCell key={`skeleton-cell-${colIndex}`} className={cn(getColumnClassName(column, false))} style={getColumnStyle(column)}>
                      {column.key === '__selection' ? <Skeleton className="h-4 w-4 bg-primary/5 rounded" /> : <Skeleton className="h-5 w-full bg-primary/5 rounded opacity-70" />}
                    </TableCell>)}
                </TableRow>) : data.length === 0 ?
          // Empty State
          <TableRow>
                <TableCell colSpan={effectiveColumns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground/60">
                    <div className="p-4 rounded-full bg-muted/30 mb-2">
                      <Inbox className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {search?.value && <p className="text-xs text-muted-foreground/40">{pbnT("m1278")}</p>}
                  </div>
                </TableCell>
              </TableRow> :
          // Data Rows
          data.map((row, rowIndex) => <TableRow key={row.id || rowIndex} data-state={selectionEnabled && selectedIds.has(row[rowIdKey]) ? 'selected' : undefined} onClick={() => !loading && onRowClick?.(row)} className={cn('group border-b border-border/40 transition-all duration-200', onRowClick ? 'cursor-pointer hover:bg-accent/40 hover:shadow-sm' : 'hover:bg-accent/50', loading && 'opacity-50 pointer-events-none', selectionEnabled && selectedIds.has(row[rowIdKey]) && 'bg-primary/5')}>
                  {effectiveColumns.map(column => <TableCell key={column.key} className={cn('py-3 text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors', getColumnClassName(column, false))} style={getColumnStyle(column)}>
                      {column.render ? column.render(row[column.key], row, rowIndex) : row[column.key]}
                    </TableCell>)}
                </TableRow>)}
          </TableBody>
        </TableWrapper>

        {/* 分页 */}
        {pagination && (totalPages > 1 || loading) && <div className='flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20'>
            <div className='flex items-center gap-2'>
              {loading ? <Skeleton className="h-4 w-32 bg-primary/5" /> : <div className='text-xs font-medium text-muted-foreground'>{pbnT("m75")}<span className="text-foreground">{pagination.total}</span>{pbnT("m1279")}<span className="text-foreground">{pagination.page}</span> / {totalPages}{" "}{pbnT("m142")}</div>}
            </div>

            {!loading && <Pager total={pagination.total} page={pagination.page} pageSize={pagination.limit} onPageChange={pagination.onPageChange} className="scale-90 origin-right py-0" />}
          </div>}
      </div>
    </div>;
}
