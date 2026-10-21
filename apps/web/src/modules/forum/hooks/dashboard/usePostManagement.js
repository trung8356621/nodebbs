'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useCallback } from 'react';
import { useAdminList } from '@/hooks/dashboard/useAdminList';
import { postApi } from '@/lib/api';
import { confirm } from '@/components/common/ConfirmPopover';
import { toast } from 'sonner';

/**
 * 回复管理 Hook
 * 组合 useAdminList，添加删除操作
 */
export function usePostManagement() {
  const pbnT = usePbnTranslations();
  const list = useAdminList({
    fetchFn: async params => {
      const apiParams = {
        ...params,
        dashboard: true
      };

      // 状态过滤映射
      if (params.statusFilter === 'deleted') {
        apiParams.isDeleted = true;
      } else if (params.statusFilter && params.statusFilter !== 'all') {
        apiParams.approvalStatus = params.statusFilter;
      }
      delete apiParams.statusFilter;
      return postApi.getAdminList(apiParams);
    },
    pageSize: 20,
    defaultFilters: {
      statusFilter: 'all'
    }
  });
  const {
    removeItem,
    updateItem,
    filters
  } = list;

  // ===== 删除操作 =====
  const handleDeleteClick = useCallback(async (e, post, type) => {
    const isHard = type === 'hard';
    const confirmed = await confirm(e, {
      title: isHard ? pbnT("m2377") : pbnT("m1797"),
      description: isHard ? pbnT("m2378") : pbnT("m2379"),
      confirmText: pbnT("m246"),
      variant: isHard ? 'destructive' : 'default'
    });
    if (!confirmed) return;
    try {
      await postApi.delete(post.id, isHard);
      toast.success(isHard ? pbnT("m2380") : pbnT("m2381"));
      if (isHard) {
        removeItem(post.id);
      } else {
        // 逻辑删除：根据筛选条件决定移除还是更新
        const currentFilter = filters.statusFilter;
        if (currentFilter !== 'all' && currentFilter !== 'deleted') {
          removeItem(post.id);
        } else {
          updateItem(post.id, {
            isDeleted: true
          });
        }
      }
    } catch (err) {
      console.error("Could not delete:", err);
      toast.error(err.message || pbnT("m249"));
    }
  }, [removeItem, updateItem, filters]);
  return {
    ...list,
    handleDeleteClick
  };
}
