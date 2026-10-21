'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { userApi, authApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 邮箱修改 Hook
 * 管理邮箱修改多步骤流程、验证码发送和提交逻辑
 */
export function useEmailChange() {
  const pbnT = usePbnTranslations();
  const {
    user,
    refreshUser
  } = useAuth();
  const {
    settings
  } = useSettings();

  // ===== 对话框状态 =====
  const [showDialog, setShowDialog] = useState(false);
  const [step, setStep] = useState(1);

  // ===== 表单状态 =====
  const [formData, setFormData] = useState({
    oldEmailCode: '',
    newEmail: '',
    newEmailCode: '',
    password: '',
    oldEmailCodeSent: false,
    newEmailCodeSent: false
  });

  // ===== 加载状态 =====
  const [loading, setLoading] = useState(false);

  // ===== 更新表单 =====
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // ===== 重置表单 =====
  const resetForm = useCallback(() => {
    const skipOldEmail = user?.isEmailVerified === false;
    setFormData({
      oldEmailCode: '',
      newEmail: '',
      newEmailCode: '',
      password: '',
      oldEmailCodeSent: skipOldEmail,
      newEmailCodeSent: false
    });
    setStep(skipOldEmail ? 2 : 1);
  }, [user?.isEmailVerified]);

  // ===== 打开对话框 =====
  const openDialog = useCallback(() => {
    setShowDialog(true);
    resetForm();
  }, [resetForm]);

  // ===== 关闭对话框 =====
  const closeDialog = useCallback(() => {
    setShowDialog(false);
    resetForm();
  }, [resetForm]);

  // ===== 发送旧邮箱验证码 =====
  const sendOldEmailCode = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authApi.sendCode(user.email, 'email_change_old');
      toast.success(result.message || pbnT("m2131"));
      setFormData(prev => ({
        ...prev,
        oldEmailCodeSent: true
      }));
    } catch (err) {
      console.error("Could not send verification code:", err);
      toast.error(err.message || pbnT("m2055"));
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // ===== 发送新邮箱验证码 =====
  const sendNewEmailCode = useCallback(async () => {
    if (!formData.newEmail.trim()) {
      toast.error(pbnT("m2132"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.newEmail)) {
      toast.error(pbnT("m1213"));
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.sendCode(formData.newEmail, 'email_change_new');
      toast.success(result.message || pbnT("m2133"));
      setFormData(prev => ({
        ...prev,
        newEmailCodeSent: true
      }));
    } catch (err) {
      console.error("Could not send verification code:", err);
      toast.error(err.message || pbnT("m2055"));
    } finally {
      setLoading(false);
    }
  }, [formData.newEmail]);

  // ===== 提交邮箱修改 =====
  const handleSubmit = useCallback(async () => {
    if (user?.isEmailVerified !== false && !formData.oldEmailCode.trim()) {
      toast.error(pbnT("m2134"));
      return;
    }
    if (!formData.newEmail.trim()) {
      toast.error(pbnT("m2132"));
      return;
    }
    if (!formData.newEmailCode.trim()) {
      toast.error(pbnT("m2135"));
      return;
    }
    if (settings.email_change_requires_password?.value && !formData.password) {
      toast.error(pbnT("m1059"));
      return;
    }
    setLoading(true);
    try {
      const result = await userApi.changeEmail(formData.oldEmailCode, formData.newEmail, formData.newEmailCode, formData.password);
      toast.success(result.message || pbnT("m2136"));
      closeDialog();
      refreshUser();
    } catch (err) {
      console.error("Could not change email:", err);
      toast.error(err.message || pbnT("m2138"));
    } finally {
      setLoading(false);
    }
  }, [formData, settings, closeDialog, refreshUser, user?.isEmailVerified]);
  return {
    // ===== 用户和设置 =====
    /** 当前用户 */
    user,
    /** 系统设置 */
    settings,
    // ===== 对话框状态 =====
    /** 对话框是否显示 */
    showDialog,
    /** 设置对话框显示状态 */
    setShowDialog,
    /** 当前步骤 */
    step,
    /** 设置步骤 */
    setStep,
    /** 打开对话框 */
    openDialog,
    /** 关闭对话框 */
    closeDialog,
    // ===== 表单数据 =====
    /** 表单数据 */
    formData,
    /** 更新表单字段 */
    updateField,
    /** 设置完整表单数据 */
    setFormData,
    // ===== 操作函数 =====
    /** 发送旧邮箱验证码 */
    sendOldEmailCode,
    /** 发送新邮箱验证码 */
    sendNewEmailCode,
    /** 提交邮箱修改 */
    handleSubmit,
    // ===== 加载状态 =====
    /** 邮箱修改中 */
    loading
  };
}
