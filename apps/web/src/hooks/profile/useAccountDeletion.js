'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 账号注销 Hook
 * 管理注销弹窗状态和提交逻辑
 */
export function useAccountDeletion() {
  const pbnT = usePbnTranslations();
  const {
    user,
    logout
  } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const openDialog = useCallback(() => {
    setShowDialog(true);
  }, []);
  const handleConfirm = useCallback(async data => {
    setLoading(true);
    try {
      const res = await userApi.requestDeletion(data);
      if (res.error) {
        throw new Error(res.error);
      }
      toast.success(pbnT("m2121"));
      setShowDialog(false);
      logout();
    } catch (err) {
      console.error("Account deletion failed:", err);
      toast.error(err.message || pbnT("m2123"));
    } finally {
      setLoading(false);
    }
  }, [logout]);
  return {
    user,
    showDialog,
    setShowDialog,
    openDialog,
    handleConfirm,
    loading
  };
}
