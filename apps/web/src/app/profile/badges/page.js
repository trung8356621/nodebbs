'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useState, useEffect } from 'react';
import BadgesList from '@/extensions/badges/components/BadgesList';
import { useAuth } from '@/contexts/AuthContext';
import { Medal } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BadgeUnlockDialog } from '@/extensions/shop/components/user/BadgeUnlockDialog';
export default function MyBadgesPage() {
  const pbnT = usePbnTranslations();
  const {
    user
  } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockBadgeItem, setUnlockBadgeItem] = useState(null);
  useEffect(() => {
    const unlockBadgeId = searchParams.get('unlockBadgeId');
    if (unlockBadgeId) {
      import('@/extensions/badges/api').then(({badgesApi})=>badgesApi.getAll({limit:100})).then(result=>{
        const badge=result.items.find(b=>String(b.id)===unlockBadgeId&&b.isOwned);
        if(badge){setUnlockBadgeItem(badge);setUnlockDialogOpen(true);}
      }).catch(()=>{});

      // 清除 URL 参数，避免刷新再次触发
      // 使用 replace 而不是 push 以免污染历史记录
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('unlockBadgeId');
      newUrl.searchParams.delete('unlockBadgeName');
      newUrl.searchParams.delete('unlockBadgeIcon');
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [searchParams, router]);
  return <>
      <div className="flex flex-col space-y-8">
        {/* Custom Hero Header */}
        {/* Hero Header - Compact & Theme Consistent */}
        <div className="relative overflow-hidden rounded-2xl bg-muted/30 border border-border/50 p-6">
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start text-center md:text-left justify-between gap-6">

            <div className="space-y-2 max-w-2xl">
               <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center md:justify-start gap-3">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                   <Medal className="h-5 w-5" />
                </span>{pbnT("m918")}</h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg">{pbnT("m919")}</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full">
          <BadgesList userId={user?.id} />
        </div>
      </div>

      <BadgeUnlockDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen} badgeItem={unlockBadgeItem} />
    </>;
}
