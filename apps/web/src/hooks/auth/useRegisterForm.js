'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { invitationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { validateUsername } from '@/utils/validateUsername';
const initialFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  invitationCode: ''
};
export function useRegisterForm({
  initialInvitationCode = '',
  onSuccess
} = {}) {
  const pbnT = usePbnTranslations();
  const {
    register
  } = useAuth();
  const {
    settings
  } = useSettings();
  const registrationMode = settings?.registration_mode?.value || 'open';
  const [formData, setFormData] = useState({
    ...initialFormData,
    invitationCode: initialInvitationCode
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitationCodeStatus, setInvitationCodeStatus] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  // Auto-validate invitation code from URL on mount
  useEffect(() => {
    if (initialInvitationCode) {
      validateInvitationCode(initialInvitationCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvitationCode]);
  const handleChange = useCallback(e => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  }, []);
  const validateInvitationCode = useCallback(async code => {
    const value = code || formData.invitationCode.trim();
    if (!value) {
      setInvitationCodeStatus(null);
      return;
    }
    try {
      const result = await invitationsApi.validate(value);
      setInvitationCodeStatus(result);
    } catch (error) {
      setInvitationCodeStatus({
        valid: false,
        message: pbnT("m2059")
      });
    }
  }, [formData.invitationCode]);
  const handleSubmit = useCallback(async e => {
    e.preventDefault();
    setError('');
    if (registrationMode === 'closed') {
      setError(pbnT("m7"));
      toast.error(pbnT("m7"));
      return;
    }
    if (registrationMode === 'invitation' && !formData.invitationCode) {
      setError(pbnT("m2060"));
      toast.error(pbnT("m2060"));
      return;
    }
    if (!formData.username || !formData.email || !formData.password) {
      setError(pbnT("m491"));
      return;
    }
    const usernameValidation = validateUsername(formData.username, pbnT);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(pbnT("m1216"));
      return;
    }
    if (formData.password.length < 6) {
      setError(pbnT("m1215"));
      return;
    }
    setIsLoading(true);
    try {
      const registerData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name || formData.username
      };
      if (registrationMode === 'invitation') {
        registerData.invitationCode = formData.invitationCode;
      }
      const result = await register({
        ...registerData,
        captchaToken
      });
      if (result.success) {
        toast.success(pbnT("m2061"));
        resetForm();
        onSuccess?.();
      } else {
        setError(result.error || pbnT("m1570"));
        toast.error(result.error || pbnT("m1570"));
      }
    } catch (err) {
      const errorMsg = err.message || pbnT("m1570");
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [formData, registrationMode, captchaToken, register, onSuccess]);
  const resetForm = useCallback(() => {
    setFormData({
      ...initialFormData
    });
    setError('');
    setInvitationCodeStatus(null);
    setCaptchaToken(null);
  }, []);
  return {
    formData,
    isLoading,
    error,
    setError,
    invitationCodeStatus,
    captchaToken,
    registrationMode,
    handleChange,
    handleSubmit,
    validateInvitationCode,
    setCaptchaToken
  };
}
