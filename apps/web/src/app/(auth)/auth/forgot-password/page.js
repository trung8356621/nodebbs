'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ForgotPasswordForm } from '@/components/auth/LoginDialog/ForgotPasswordForm';
import { toast } from 'sonner';
export default function ForgotPasswordPage() {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const {
    isAuthenticated
  } = useAuth();
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
        <CardTitle className="text-2xl">{pbnT("m0")}</CardTitle>
        <CardDescription>{pbnT("m1")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm onSuccess={() => {
        toast.success(pbnT("m2"));
        router.push('/auth/login');
      }} />

        <div className="text-center text-sm mt-4">
          <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push('/auth/login')}>{pbnT("m3")}</Button>
        </div>
      </CardContent>
    </Card>;
}
