'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
export function usePhoneLoginForm({
  onSuccess
} = {}) {
  const pbnT = usePbnTranslations();
  const {
    loginByPhone
  } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);
  const validatePhone = useCallback(value => {
    return /^1[3-9]\d{9}$/.test(value);
  }, []);

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    setError('');
    if (!phone.trim()) {
      setError(pbnT("m1236"));
      return;
    }
    if (!validatePhone(phone.trim())) {
      setError(pbnT("m2053"));
      return;
    }
    setIsLoading(true);
    try {
      await authApi.sendCode(phone.trim(), 'phone_login');
      setCountdown(60);
      toast.success(pbnT("m2054"));
    } catch (err) {
      setError(err.message || pbnT("m2055"));
    } finally {
      setIsLoading(false);
    }
  }, [phone, validatePhone]);

  // 验证码登录
  const handleSubmit = useCallback(async e => {
    e?.preventDefault();
    setError('');
    if (!phone.trim() || !code.trim()) {
      setError(pbnT("m2056"));
      return;
    }
    if (!validatePhone(phone.trim())) {
      setError(pbnT("m2053"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await loginByPhone(phone.trim(), code.trim());
      if (result.success) {
        if (result.isNewUser) {
          toast.success(pbnT("m2057"));
        } else if (result.needSetPassword) {
          toast.success(pbnT("m2058"));
        } else {
          toast.success(pbnT("m31"));
        }
        resetForm();
        onSuccess?.();
      } else {
        setError(result.error || pbnT("m33"));
        toast.error(result.error || pbnT("m33"));
      }
    } catch (err) {
      const errorMsg = err.message || pbnT("m33");
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [phone, code, loginByPhone, onSuccess, validatePhone]);
  const resetForm = useCallback(() => {
    setPhone('');
    setCode('');
    setError('');
    setCountdown(0);
  }, []);
  return {
    phone,
    setPhone,
    code,
    setCode,
    countdown,
    isLoading,
    error,
    setError,
    handleSendCode,
    handleSubmit,
    resetForm
  };
}
