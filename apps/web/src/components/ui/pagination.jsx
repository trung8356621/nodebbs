import { usePbnTranslations } from "@/i18n/useTranslations";
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
function Pagination({
  className,
  ...props
}) {
  const pbnT = usePbnTranslations();
  return <nav role="navigation" aria-label={pbnT("e4")} data-slot="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
}
function PaginationContent({
  className,
  ...props
}) {
  return <ul data-slot="pagination-content" className={cn("flex flex-row items-center gap-1", className)} {...props} />;
}
function PaginationItem({
  ...props
}) {
  return <li data-slot="pagination-item" {...props} />;
}
function PaginationLink(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    className,
    isActive,
    size = 'icon',
    ...props
  } = pbnArgument0;
  return <a aria-current={isActive ? "page" : undefined} data-slot="pagination-link" data-active={isActive} className={cn(buttonVariants({
    variant: isActive ? "outline" : "ghost",
    size
  }), className)} {...props} />;
}
function PaginationPrevious({
  className,
  ...props
}) {
  const pbnT = usePbnTranslations();
  return <PaginationLink aria-label={pbnT("e1")} size="default" className={cn("gap-1 px-2.5 sm:pl-2.5 cursor-pointer", className)} {...props}>
      <ChevronLeftIcon />
      <span className="hidden">{pbnT("m140")}</span>
    </PaginationLink>;
}
function PaginationNext({
  className,
  ...props
}) {
  const pbnT = usePbnTranslations();
  return <PaginationLink aria-label={pbnT("e2")} size="default" className={cn("gap-1 px-2.5 sm:pr-2.5 cursor-pointer", className)} {...props}>
      <span className="hidden">{pbnT("m143")}</span>
      <ChevronRightIcon />
    </PaginationLink>;
}
function PaginationEllipsis({
  className,
  ...props
}) {
  const pbnT = usePbnTranslations();
  return <span aria-hidden data-slot="pagination-ellipsis" className={cn("flex size-9 items-center justify-center", className)} {...props}>
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">{pbnT("e3")}</span>
    </span>;
}
export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis };
