'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 密码修改 Hook
 * 管理密码修改表单状态和提交逻辑
 */
export function usePasswordChange() {
  const pbnT = usePbnTranslations();
  const {
    user,
    checkAuth
  } = useAuth();

  // ===== 表单状态 =====
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // ===== 加载状态 =====
  const [changingPassword, setChangingPassword] = useState(false);

  // ===== 更新表单字段 =====
  const updateField = useCallback((field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // ===== 提交密码修改 =====
  const handleSubmit = useCallback(async e => {
    e.preventDefault();

    // 根据用户是否已有密码决定是否验证 currentPassword
    const needCurrentPassword = user?.hasPassword !== false;
    if (needCurrentPassword && !passwordData.currentPassword) {
      toast.error(pbnT("m2159"));
      return;
    }
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error(pbnT("m2160"));
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error(pbnT("m2161"));
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(pbnT("m2162"));
      return;
    }
    setChangingPassword(true);
    try {
      // 对于首次设置密码的用户，传空字符串或 null 作为 currentPassword
      const currentPwd = needCurrentPassword ? passwordData.currentPassword : '';
      const res = await userApi.changePassword(currentPwd, passwordData.newPassword);
      if (res.error) {
        throw new Error(res.error);
      }
      toast.success(pbnT("m2163"));
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      console.error("Could not change password:", err);
      toast.error(err.message || pbnT("m2165"));
    } finally {
      setChangingPassword(false);
    }
  }, [user, passwordData]);
  return {
    // ===== 用户数据 =====
    /** 当前用户 */
    user,
    // ===== 表单数据 =====
    /** 密码表单数据 */
    passwordData,
    /** 更新表单字段 */
    updateField,
    // ===== 操作函数 =====
    /** 提交密码修改 */
    handleSubmit,
    /** 验证邮箱后的回调 */
    onEmailVerified: checkAuth,
    // ===== 加载状态 =====
    /** 密码修改中 */
    changingPassword
  };
}
