'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { toast } from 'sonner';
import { LoginSection } from '@/components/auth/LoginSection';
import { RegisterSection } from '@/components/auth/RegisterSection';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ModeSwitcher } from './ModeSwitcher';
const MODE_CONFIG = (pbnT = pbnRuntimeT) => ({
  login: {
    title: pbnT("m4"),
    description: pbnT("m5")
  },
  register: {
    title: pbnT("m8"),
    description: pbnT("m9")
  },
  'forgot-password': {
    title: pbnT("m0"),
    description: pbnT("m1")
  }
});
export default function LoginDialog({
  open,
  onOpenChange
}) {
  const pbnT = usePbnTranslations();
  const [mode, setMode] = useState('login');
  const [dialogKey, setDialogKey] = useState(0);
  const {
    title,
    description
  } = MODE_CONFIG(pbnT)[mode];
  const handleOpenChange = isOpen => {
    if (!isOpen) {
      setMode('login');
      setDialogKey(k => k + 1);
    }
    onOpenChange?.(isOpen);
  };
  const handleClose = () => handleOpenChange(false);
  return <FormDialog open={open} onOpenChange={handleOpenChange} title={title} description={description} maxWidth="sm:max-w-[450px]" footer={null}>
      <div key={dialogKey}>
        {mode === 'login' && <LoginSection onSuccess={handleClose} onForgotPassword={() => setMode('forgot-password')} />}
        {mode === 'register' && <RegisterSection onSuccess={handleClose} />}
        {mode === 'forgot-password' && <ForgotPasswordForm onSuccess={() => {
        setMode('login');
        toast.success(pbnT("m2"));
      }} />}
      </div>

      <ModeSwitcher mode={mode} onModeChange={setMode} />
    </FormDialog>;
}
