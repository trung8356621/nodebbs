'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useRegisterForm } from '@/hooks/auth/useRegisterForm';
import { useOAuthProviders } from '@/hooks/auth/useOAuthProviders';
import { RegisterForm } from '@/components/auth/LoginDialog/RegisterForm';
import { OAuthSection } from '@/components/auth/LoginDialog/OAuthSection';
export function RegisterSection({
  initialInvitationCode = '',
  onSuccess
}) {
  const pbnT = usePbnTranslations();
  const registerForm = useRegisterForm({
    initialInvitationCode,
    onSuccess
  });
  const {
    oauthProviders
  } = useOAuthProviders();
  if (registerForm.registrationMode === 'closed') {
    return <p className="text-center text-muted-foreground text-sm py-4">{pbnT("m7")}</p>;
  }
  return <>
      <RegisterForm formData={registerForm.formData} error={registerForm.error} isLoading={registerForm.isLoading} registrationMode={registerForm.registrationMode} invitationCodeStatus={registerForm.invitationCodeStatus} onSubmit={registerForm.handleSubmit} onChange={registerForm.handleChange} onInvitationCodeBlur={() => registerForm.validateInvitationCode()} onCaptchaVerify={registerForm.setCaptchaToken} />
      <OAuthSection providers={oauthProviders} isLogin={false} isLoading={registerForm.isLoading} setIsLoading={() => {}} setError={registerForm.setError} />
    </>;
}
