'use client';

import { Badge } from '@/components/ui/badge';

const TONE = {
  ok: 'default',
  warn: 'secondary',
  err: 'destructive',
  muted: 'outline',
};

export function StatusBadge({ tone = 'muted', children }) {
  return <Badge variant={TONE[tone] || 'outline'}>{children}</Badge>;
}
