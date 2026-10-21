'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { userApi, authApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 手机号修改 Hook
 * 管理手机号修改多步骤流程、验证码发送和提交逻辑
 */
export function usePhoneChange() {
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
    oldPhoneCode: '',
    newPhone: '',
    newPhoneCode: '',
    password: '',
    oldPhoneCodeSent: false,
    newPhoneCodeSent: false
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
    setFormData({
      oldPhoneCode: '',
      newPhone: '',
      newPhoneCode: '',
      password: '',
      oldPhoneCodeSent: false,
      newPhoneCodeSent: false
    });
    setStep(1);
  }, []);

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

  // ===== 发送旧手机号验证码 =====
  const sendOldPhoneCode = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authApi.sendCode(user.phone, 'phone_change_old');
      toast.success(result.message || pbnT("m2166"));
      setFormData(prev => ({
        ...prev,
        oldPhoneCodeSent: true
      }));
    } catch (err) {
      console.error("Could not send verification code:", err);
      toast.error(err.message || pbnT("m2055"));
    } finally {
      setLoading(false);
    }
  }, [user?.phone]);

  // ===== 发送新手机号验证码 =====
  const sendNewPhoneCode = useCallback(async () => {
    if (!formData.newPhone.trim()) {
      toast.error(pbnT("m2167"));
      return;
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.newPhone)) {
      toast.error(pbnT("m2053"));
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.sendCode(formData.newPhone, 'phone_change_new');
      toast.success(result.message || pbnT("m2168"));
      setFormData(prev => ({
        ...prev,
        newPhoneCodeSent: true
      }));
    } catch (err) {
      console.error("Could not send verification code:", err);
      toast.error(err.message || pbnT("m2055"));
    } finally {
      setLoading(false);
    }
  }, [formData.newPhone]);

  // ===== 提交手机号修改 =====
  const handleSubmit = useCallback(async () => {
    if (!formData.oldPhoneCode.trim()) {
      toast.error(pbnT("m2169"));
      return;
    }
    if (!formData.newPhone.trim()) {
      toast.error(pbnT("m2167"));
      return;
    }
    if (!formData.newPhoneCode.trim()) {
      toast.error(pbnT("m2170"));
      return;
    }
    if (settings.phone_change_requires_password?.value && user?.hasPassword && !formData.password) {
      toast.error(pbnT("m1059"));
      return;
    }
    setLoading(true);
    try {
      const result = await userApi.changePhone(formData.oldPhoneCode, formData.newPhone, formData.newPhoneCode, formData.password);
      toast.success(result.message || pbnT("m2171"));
      closeDialog();
      refreshUser();
    } catch (err) {
      console.error("Could not change phone:", err);
      toast.error(err.message || pbnT("m2173"));
    } finally {
      setLoading(false);
    }
  }, [formData, settings, user, closeDialog, refreshUser]);
  return {
    user,
    settings,
    showDialog,
    setShowDialog,
    step,
    setStep,
    openDialog,
    closeDialog,
    formData,
    updateField,
    setFormData,
    sendOldPhoneCode,
    sendNewPhoneCode,
    handleSubmit,
    loading
  };
}
