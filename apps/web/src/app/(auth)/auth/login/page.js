'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoginSection } from '@/components/auth/LoginSection';
export default function LoginPage() {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const {
    isAuthenticated
  } = useAuth();
  const {
    settings
  } = useSettings();
  const registrationMode = settings?.registration_mode?.value || 'open';
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);
  if (isAuthenticated) {
    return null;
  }
  return <Card className="w-full max-w-md shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{pbnT("m4")}</CardTitle>
        <CardDescription>{pbnT("m5")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginSection onSuccess={() => router.push('/')} onForgotPassword={() => router.push('/auth/forgot-password')} />

        <div className="text-center text-sm mt-4 space-y-2">
          {registrationMode !== 'closed' && <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push('/auth/register')}>{pbnT("m6")}</Button>}
          {registrationMode === 'closed' && <p className="text-muted-foreground text-xs">{pbnT("m7")}</p>}
        </div>
      </CardContent>
    </Card>;
}
