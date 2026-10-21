import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useEffect, useState, useCallback } from 'react';
import { badgesApi } from '../api';
import BadgeCard from './BadgeCard';
import { toast } from 'sonner';
export default function BadgesList({
  userId
}) {
  const pbnT = usePbnTranslations();
  const [allBadges, setAllBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  useEffect(() => {
    async function fetchData() {
      try {
        const badgesRes = await badgesApi.getAll({
          limit: 100
        });
        setAllBadges(badgesRes.items || []);
      } catch (error) {
        console.error('Failed to fetch badges', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  // 切换勋章展示状态
  const handleToggleDisplay = useCallback(async (userBadgeId, isDisplayed) => {
    setUpdatingIds(prev => new Set(prev).add(userBadgeId));
    try {
      const result = await badgesApi.updateDisplay(userBadgeId, {
        isDisplayed
      });
      if (result.success) {
        // 更新本地状态
        setAllBadges(prev => prev.map(badge => {
          if (badge.userBadgeId === userBadgeId) {
            return {
              ...badge,
              isDisplayed
            };
          }
          return badge;
        }));
        toast.success(isDisplayed ? pbnT("m1738") : pbnT("m1739"));
      }
    } catch (error) {
      console.error('Failed to update badge display', error);
      toast.error(pbnT("m1740"));
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(userBadgeId);
        return next;
      });
    }
  }, []);

  // 统计数据
  const ownedCount = allBadges.filter(b => b.isOwned).length;
  const displayedCount = allBadges.filter(b => b.isOwned && b.isDisplayed !== false).length;
  const totalCount = allBadges.length;

  // 排序：已拥有的在前，按 displayOrder 排序
  const sortedBadges = [...allBadges].sort((a, b) => {
    if (a.isOwned && !b.isOwned) return -1;
    if (!a.isOwned && b.isOwned) return 1;
    return (a.displayOrder || 0) - (b.displayOrder || 0);
  });
  if (loading) return <div className="space-y-8 animate-pulse">
      {/* Loading Header */}
      <div className="h-14 w-full bg-muted/40 rounded-xl" />
      
      {/* Loading Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
         {Array.from({
        length: 12
      }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-xl bg-muted/40" />)}
      </div>
    </div>;
  return <div className="space-y-8">
      {/* 头部统计 */}
      <div className="bg-muted/30 p-4 rounded-xl border border-border/50 flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">{pbnT("m1741")}</div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-primary">{ownedCount}</span>
            <span className="text-muted-foreground">/ {totalCount}{" "}{pbnT("m1736")}</span>
          </div>
          {ownedCount > 0 && <>
              <div className="w-px h-4 bg-border mx-2" />
              <div className="text-muted-foreground">{pbnT("m1742")}<span className="font-medium text-foreground">{displayedCount}</span>
              </div>
            </>}
        </div>
      </div>

      {/* 勋章网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {sortedBadges.map(badge => <BadgeCard key={badge.id} badge={badge} isUnlocked={badge.isOwned} isDisplayed={badge.isDisplayed !== false} userBadgeId={badge.userBadgeId} onToggleDisplay={badge.isOwned ? handleToggleDisplay : undefined} isUpdating={updatingIds.has(badge.userBadgeId)} />)}
      </div>
    </div>;
}
