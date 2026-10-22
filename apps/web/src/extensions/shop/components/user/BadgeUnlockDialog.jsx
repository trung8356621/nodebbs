'use client';
import {Award} from 'lucide-react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {localizeBadge} from '@/extensions/badges/presentation';
export function BadgeUnlockDialog({open,onOpenChange,badgeItem}) {
  const t=usePbnTranslations();if(!badgeItem)return null;
  const badge=localizeBadge(badgeItem,t);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md" data-testid="badge-unlock-dialog"><DialogHeader><DialogTitle>{t('badgeUnlockTitle')}</DialogTitle><DialogDescription>{t('badgeUnlockBody')}</DialogDescription></DialogHeader><div className="flex flex-col items-center gap-4 py-4">{badge.iconUrl||badge.imageUrl?<img src={badge.iconUrl||badge.imageUrl} alt={badge.name} className="h-24 w-24 object-contain"/>:<Award className="h-16 w-16 text-primary"/>}<h2 className="font-semibold">{badge.name}</h2><p>{badge.description}</p></div><Button onClick={()=>onOpenChange(false)}>{t('badgeClose')}</Button></DialogContent></Dialog>;
}
