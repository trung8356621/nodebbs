'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RegisterSection } from '@/components/auth/RegisterSection';
export default function RegisterPage() {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated
  } = useAuth();
  const {
    settings
  } = useSettings();
  const codeFromUrl = searchParams.get('code') || '';
  const registrationMode = settings?.registration_mode?.value || 'open';
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);
  if (isAuthenticated) {
    return null;
  }
  const isClosed = registrationMode === 'closed';
  return <Card className="w-full max-w-md shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{pbnT("m8")}</CardTitle>
        <CardDescription>
          {isClosed ? pbnT("m7") : pbnT("m9")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isClosed && <RegisterSection initialInvitationCode={codeFromUrl} onSuccess={() => router.push('/')} />}

        <div className="text-center text-sm mt-4">
          <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push('/auth/login')}>
            {isClosed ? pbnT("m3") : pbnT("m10")}
          </Button>
        </div>
      </CardContent>
    </Card>;
}
