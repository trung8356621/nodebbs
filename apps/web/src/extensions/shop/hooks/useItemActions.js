import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { shopApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 处理物品装备/卸下/使用/激活操作的 Hook
 * @returns {Object} { equip, unequip, useItem, actioning, actioningItemId }
 */
export function useItemActions() {
  const pbnT = usePbnTranslations();
  const [actioningItemId, setActioningItemId] = useState(null);
  const equip = useCallback(async (userItemId, onSuccess) => {
    setActioningItemId(userItemId);
    try {
      const response = await shopApi.equipItem(userItemId);
      toast.success(pbnT("m2023"));
      if (onSuccess) await onSuccess(response);
    } catch (err) {
      console.error("Could not equip:", err);
      toast.error(err.message || pbnT("m2025"));
    } finally {
      setActioningItemId(null);
    }
  }, []);
  const unequip = useCallback(async (userItemId, onSuccess) => {
    setActioningItemId(userItemId);
    try {
      const response = await shopApi.unequipItem(userItemId);
      toast.success(pbnT("m2026"));
      if (onSuccess) await onSuccess(response);
    } catch (err) {
      console.error("Could not unequip:", err);
      toast.error(err.message || pbnT("m2028"));
    } finally {
      setActioningItemId(null);
    }
  }, []);

  // 使用消耗品
  const useItem = useCallback(async (userItemId, data, onSuccess) => {
    setActioningItemId(userItemId);
    try {
      const response = await shopApi.useItem(userItemId, data);
      toast.success(pbnT("m2029"));
      if (onSuccess) await onSuccess(response);
    } catch (err) {
      console.error("Could not use item:", err);
      toast.error(err.message || pbnT("m2031"));
    } finally {
      setActioningItemId(null);
    }
  }, []);
  return {
    equip,
    unequip,
    useItem,
    actioning: actioningItemId !== null,
    actioningItemId
  };
}
