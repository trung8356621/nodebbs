'use client';

import { Pin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { useDeadlineExpired } from '@/hooks/usePaidPinExpired';
import { cn } from '@/lib/utils';

/** Server `linkPolicy === "paid"`, dropped on the same SEO deadline as outbound links. */
export function useSeoActive(topic) {
  const deadline = topic?.linkPolicy === 'paid' ? topic.seoExpiresAt : null;
  const expired = useDeadlineExpired(deadline, topic?.pinServerNow);
  return topic?.linkPolicy === 'paid' && !expired;
}

export function formatSeoExpiry(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' });
}

const seoFrameStyle = {
  border: '3px solid transparent',
  backgroundImage: 'linear-gradient(var(--card), var(--card)), linear-gradient(90deg,#ef4444 0%,#f97316 14.28%,#eab308 28.57%,#22c55e 42.86%,#06b6d4 57.14%,#3b82f6 71.43%,#a855f7 100%)',
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
};

export function SeoActiveFrame({ active, className, innerClassName, children }) {
  if (!active) return children;
  return (
    <div data-seo-active="true" className={cn('w-full min-w-0 rounded-lg', className)} style={seoFrameStyle}>
      <div className={cn('min-w-0 overflow-hidden bg-card rounded-[calc(var(--radius)-3px)]', innerClassName)}>
        {children}
      </div>
    </div>
  );
}

export function SeoActiveBadge({ topic, size = 'default' }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const seoActive = useSeoActive(topic);
  if (!seoActive) return null;
  const compact = size === 'compact';
  const expiry = topic?.seoExpiresAt ? formatSeoExpiry(topic.seoExpiresAt, locale) : '';
  const badge = (
    <span
      data-seo-badge="true"
      className={cn(
        'relative z-10 inline-flex items-center font-medium bg-foreground text-background align-middle',
        compact ? 'px-1.5 py-0.5 rounded text-[10px] shrink-0' : 'px-2 py-0.5 rounded-full text-xs mr-1.5',
      )}
    >
      {t('seoActiveBadge')}
    </span>
  );
  if (!expiry) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{t('seoUntil', { date: expiry })}</TooltipContent>
    </Tooltip>
  );
}

export function PinnedBadge({ topic, size = 'default' }) {
  const pbnT = usePbnTranslations();
  if (!topic?.isPinned) return null;
  const compact = size === 'compact';
  return (
    <span
      data-pin-badge="true"
      className={cn(
        'relative z-10 inline-flex items-center font-medium bg-primary/10 text-primary align-middle',
        compact ? 'gap-0.5 px-1.5 py-0.5 rounded text-[10px] shrink-0' : 'gap-1 px-2 py-0.5 rounded-full text-xs mr-1.5',
      )}
    >
      <Pin className="w-3 h-3" />
      {pbnT('m1175')}
    </span>
  );
}
