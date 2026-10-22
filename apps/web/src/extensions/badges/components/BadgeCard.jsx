'use client';
import {Award,Lock} from 'lucide-react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {localizeBadge} from '@/extensions/badges/presentation';
import UserAvatar from '@/components/user/UserAvatar';
import {Button} from '@/components/ui/button';
export default function BadgeCard({badge,isUnlocked=false,isDisplayed=false,userBadgeId,onToggleDisplay,isUpdating=false}) {
  const t=usePbnTranslations(),data=localizeBadge(badge,t),theme=badge.frameTheme||'common';
  return <section className="content-card p-4 space-y-3" data-testid="badge-card" data-badge-slug={badge.slug}>
    <div className="flex items-center gap-3"><UserAvatar name={data.name} size="xl" frameMetadata={{theme}}/>{badge.iconUrl?<img src={badge.iconUrl} alt={data.name} className="h-12 w-12 object-contain"/>:<Award className="h-10 w-10"/>}</div>
    <h3 className="font-semibold">{data.name}</h3><p className="text-sm text-muted-foreground">{data.description}</p><p className="text-sm">{t('badgeFrame_'+theme)}</p>
    {isUnlocked?<Button variant={isDisplayed?'default':'outline'} disabled={isUpdating} aria-pressed={Boolean(isDisplayed)} onClick={()=>onToggleDisplay(userBadgeId,!isDisplayed)}>{t(isDisplayed?'badgeUnequip':'badgeEquip')}</Button>:<p className="flex gap-2 items-center text-sm text-muted-foreground"><Lock className="h-4 w-4"/>{t('badgeLocked')}</p>}
  </section>;
}
