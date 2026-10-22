'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {useAuth} from '@/contexts/AuthContext';
import {badgesApi} from '@/extensions/badges/api';
import {localizeBadge} from '@/extensions/badges/presentation';
import UserAvatar from '@/components/user/UserAvatar';
import BadgeCard from './BadgeCard';
export default function BadgesList({userId}) {
  const t=usePbnTranslations(),{user,refreshUser}=useAuth();
  const [badges,setBadges]=useState([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const load=async()=>{const result=await badgesApi.getAll({limit:100});setBadges(result.items||[]);};
  useEffect(()=>{load().catch(()=>toast.error(t('badgeError'))).finally(()=>setLoading(false));},[userId]);
  const equip=async(id,isDisplayed)=>{setBusy(true);try{await badgesApi.updateDisplay(id,{isDisplayed});await load();await refreshUser();}catch{toast.error(t('badgeError'));}finally{setBusy(false);}};
  if(loading)return <div className="h-32 animate-pulse rounded bg-muted"/>;
  const selected=badges.find(b=>b.isOwned&&b.isDisplayed),active=selected?localizeBadge(selected,t):null;
  return <div className="space-y-6" data-testid="badges-page">
    <section className="content-card p-4 flex items-center gap-4" data-testid="badge-preview">
      <UserAvatar url={user?.avatar} name={user?.name||user?.username} size="xl" frameMetadata={selected?{theme:selected.frameTheme}:null}/>
      <div><h2 className="font-semibold">{t('badgeFramePreview')}</h2><p>{active?.name||t('badgeDefaultFrame')}</p><p className="text-sm text-muted-foreground">{t('badgeDecorationNote')}</p></div>
    </section>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{badges.map(badge=><BadgeCard key={badge.id} badge={badge} isUnlocked={badge.isOwned} isDisplayed={badge.isDisplayed} userBadgeId={badge.userBadgeId} onToggleDisplay={equip} isUpdating={busy}/>)}</div>
  </div>;
}
