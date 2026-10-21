'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 隐私设置 Hook
 * 管理站内信权限和内容可见性等隐私设置
 */
export function usePrivacySettings() {
  const pbnT = usePbnTranslations();
  const {
    user,
    refreshUser
  } = useAuth();

  // ===== 表单状态 =====
  const [formData, setFormData] = useState({
    messagePermission: 'everyone',
    contentVisibility: 'everyone'
  });

  // ===== 加载状态 =====
  const [loading, setLoading] = useState(false);

  // ===== 同步用户数据到表单（仅在初始加载时） =====
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (user && !initialized) {
      setFormData({
        messagePermission: user.messagePermission || 'everyone',
        contentVisibility: user.contentVisibility || 'everyone'
      });
      setInitialized(true);
    }
  }, [user, initialized]);

  // ===== 更新表单字段 =====
  const updateField = useCallback((field, value) => {
    // 防止 Radix UI Select 意外触发的空值
    if (value === '' || value === undefined || value === null) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // ===== 提交表单 =====
  const handleSubmit = useCallback(async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await userApi.updateProfile({
        messagePermission: formData.messagePermission,
        contentVisibility: formData.contentVisibility
      });
      toast.success(pbnT("m2174"));
      setLoading(false);
      refreshUser();
    } catch (err) {
      console.error("Could not update privacy settings:", err);
      toast.error(err.message || pbnT("m2176"));
      setLoading(false);
    }
  }, [formData, refreshUser]);
  return {
    // ===== 表单数据 =====
    /** 表单数据 */
    formData,
    // ===== 操作函数 =====
    /** 更新表单字段 */
    updateField,
    /** 提交表单 */
    handleSubmit,
    // ===== 加载状态 =====
    /** 表单提交中 */
    loading
  };
}
