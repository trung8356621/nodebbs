'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback, useEffect } from 'react';
import { useAdminList } from '@/hooks/dashboard/useAdminList';
import { topicApi } from '@/lib/api';
import { confirm } from '@/components/common/ConfirmPopover';
import { toast } from 'sonner';

/**
 * 话题管理 Hook
 * 组合 useAdminList，添加置顶/关闭/删除/批量删除操作
 */
export function useTopicManagement() {
  const pbnT = usePbnTranslations();
  const list = useAdminList({
    fetchFn: async params => {
      const apiParams = {
        ...params,
        dashboard: true
      };

      // 状态过滤映射
      const sf = params.statusFilter;
      if (sf === 'deleted') {
        apiParams.isDeleted = true;
      } else if (sf === 'pinned') {
        apiParams.isPinned = true;
      } else if (sf === 'closed') {
        apiParams.isClosed = true;
      } else if (sf === 'pending') {
        apiParams.approvalStatus = 'pending';
      } else if (sf === 'rejected') {
        apiParams.approvalStatus = 'rejected';
      }
      delete apiParams.statusFilter;
      return topicApi.getList(apiParams);
    },
    pageSize: 20,
    defaultFilters: {
      statusFilter: 'all'
    }
  });
  const {
    removeItem,
    updateItem,
    filters,
    debouncedSearch,
    refreshList
  } = list;

  // ===== 批量选择 =====
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 筛选条件变化时清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, filters.statusFilter]);

  // ===== 置顶 =====
  const handleTogglePin = useCallback(async (topicId, isPinned) => {
    try {
      await topicApi.update(topicId, {isPinned:!isPinned});
      const fresh=await topicApi.getById(topicId);
      toast.success(isPinned ? pbnT("m2391") : pbnT("m2392"));
      if(filters.statusFilter==='pinned'&&!fresh.isPinned)removeItem(topicId);
      else updateItem(topicId,fresh);
    } catch(err) {
      toast.error(err.message || pbnT("m568"));
    }
  },[filters,removeItem,updateItem]);

  // ===== 关闭/开启 =====
  const handleToggleClosed = useCallback(async (topicId, isClosed) => {
    try {
      await topicApi.update(topicId, {
        isClosed: !isClosed
      });
      toast.success(isClosed ? pbnT("m2393") : pbnT("m831"));
      if (filters.statusFilter === 'closed' && isClosed) {
        removeItem(topicId);
      } else {
        updateItem(topicId, {
          isClosed: !isClosed
        });
      }
    } catch (err) {
      toast.error(err.message || pbnT("m568"));
    }
  }, [filters, removeItem, updateItem]);

  // ===== 删除 =====
  const handleDeleteClick = useCallback(async (e, topic, type) => {
    const isHard = type === 'hard';
    const confirmed = await confirm(e, {
      title: isHard ? pbnT("m2377") : pbnT("m1797"),
      description: isHard ? pbnT("m2394", {
        arg0: topic.title
      }) : pbnT("m2395", {
        arg0: topic.title
      }),
      confirmText: pbnT("m246"),
      variant: isHard ? 'destructive' : 'default'
    });
    if (!confirmed) return;
    try {
      await topicApi.delete(topic.id, isHard);
      toast.success(isHard ? pbnT("m2396") : pbnT("m2397"));
      if (isHard) {
        removeItem(topic.id);
      } else {
        const sf = filters.statusFilter;
        if (sf !== 'all' && sf !== 'deleted') {
          removeItem(topic.id);
        } else {
          updateItem(topic.id, {
            isDeleted: true
          });
        }
      }
    } catch (err) {
      console.error("Could not delete:", err);
      toast.error(err.message || pbnT("m249"));
    }
  }, [filters, removeItem, updateItem]);

  // ===== 批量删除 =====
  const handleBatchDelete = useCallback(async (ids, e) => {
    const count = ids.size;
    const confirmed = await confirm(e, {
      title: pbnT("m2398", {
        arg0: count
      }),
      description: pbnT("m2399"),
      confirmText: pbnT("m246"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setBatchDeleting(true);
    try {
      const result = await topicApi.batchDelete([...ids]);
      toast.success(pbnT("m2400", {
        arg0: result.count
      }));
      setSelectedIds(new Set());
      refreshList();
    } catch (err) {
      toast.error(err.message || pbnT("m2401"));
    } finally {
      setBatchDeleting(false);
    }
  }, [refreshList]);
  return {
    ...list,
    selectedIds,
    setSelectedIds,
    batchDeleting,
    handleTogglePin,
    handleToggleClosed,
    handleDeleteClick,
    handleBatchDelete
  };
}
