'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
export function Pager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className
}) {
  const pbnT = usePbnTranslations();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const handlePageChange = newPage => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  // 动态生成页码（带省略号）
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };
  const pages = getPageNumbers();
  return <div className={cn('flex items-center justify-between gap-4 py-4', className)}>
      {/* 左侧：页大小选择 */}
      {onPageSizeChange && <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{pbnT("m1461")}<Select value={String(pageSize)} onValueChange={v => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map(size => <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>)}
            </SelectContent>
          </Select>{pbnT("m1462")}{" "}{total}{" "}{pbnT("m1463")}</div>}

      {/* 右侧：分页导航 */}
      <Pagination className='justify-end'>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => handlePageChange(page - 1)} className={cn(page <= 1 && 'pointer-events-none opacity-50')} />
          </PaginationItem>

          {pages.map((p, idx) => p === '...' ? <PaginationItem key={`ellipsis-${idx}`} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem> : <PaginationItem key={p} className={p === page ? '' : 'hidden sm:block'}>
                <PaginationLink onClick={() => handlePageChange(p)} isActive={p === page} className="cursor-pointer">
                  {p}
                </PaginationLink>
              </PaginationItem>)}

          <PaginationItem>
            <PaginationNext onClick={() => handlePageChange(page + 1)} className={cn(page >= totalPages && 'pointer-events-none opacity-50')} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>;
}
