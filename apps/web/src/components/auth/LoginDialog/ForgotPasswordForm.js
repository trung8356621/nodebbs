'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from './FormMessage';
import { CaptchaWidget } from '@/components/captcha/CaptchaWidget';
import { Loader2, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api';

/**
 * 找回密码表单 - 使用验证码方式
 * 步骤1：输入邮箱，发送验证码
 * 步骤2：输入验证码和新密码
 * 步骤3：提交重置
 */
export function ForgotPasswordForm({
  onSuccess
}) {
  const pbnT = usePbnTranslations();
  const [step, setStep] = useState(1); // 1: 输入邮箱, 2: 输入验证码和密码
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  // 发送验证码
  const handleSendCode = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError(pbnT("m1212"));
      return;
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(pbnT("m1213"));
      return;
    }
    setIsLoading(true);
    try {
      const data = await authApi.sendCode(email, 'email_password_reset', captchaToken);
      setSuccess(data.message || pbnT("m1201"));
      setStep(2); // 进入下一步
    } catch (err) {
      setError(err.message || pbnT("m1202"));
    } finally {
      setIsLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!code.trim()) {
      setError(pbnT("m1203"));
      return;
    }
    if (!password || !confirmPassword) {
      setError(pbnT("m1214"));
      return;
    }
    if (password.length < 6) {
      setError(pbnT("m1215"));
      return;
    }
    if (password !== confirmPassword) {
      setError(pbnT("m1216"));
      return;
    }
    setIsLoading(true);
    try {
      const data = await authApi.resetPassword(email, code, password);
      setSuccess(data.message || pbnT("m1217"));
      // 调用成功回调
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || pbnT("m1218"));
    } finally {
      setIsLoading(false);
    }
  };
  return <div>
      {/* 步骤指示器 */}
      <div className='flex items-center justify-center space-x-2 mb-6'>
        {[1, 2].map(s => <div key={s} className='flex items-center'>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {step > s ? <CheckCircle2 className='h-4 w-4' /> : s}
            </div>
            {s < 2 && <div className={`w-16 h-0.5 ${step > s ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>)}
      </div>

      {/* 步骤1：输入邮箱并发送验证码 */}
      {step === 1 && <form onSubmit={handleSendCode}>
          <div className='grid gap-4 py-4'>
            <FormMessage error={error} success={success} />

            <div className='grid gap-2'>
              <Label htmlFor='email'>{pbnT("m1219")}</Label>
              <Input id='email' name='email' type='email' placeholder={pbnT("m1220")} value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} required />
              <p className='text-xs text-muted-foreground'>{pbnT("m1221")}</p>
            </div>

            {/* 人机验证 */}
            <CaptchaWidget scene="passwordReset" onVerify={setCaptchaToken} />
          </div>

          <div className="pt-2">
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m615")}</> : <>
                  <Mail className='h-4 w-4' />{pbnT("m1026")}</>}
            </Button>
          </div>
        </form>}

      {/* 步骤2：输入验证码和新密码 */}
      {step === 2 && <form onSubmit={handleResetPassword}>
          <div className='grid gap-4 py-4'>
            <FormMessage error={error} success={success} />

            <div className='p-3 bg-muted rounded-lg'>
              <p className='text-sm text-muted-foreground'>{pbnT("m1032")}<span className='font-medium text-card-foreground ml-1'>
                  {email}
                </span>
              </p>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='code'>{pbnT("m1033")}</Label>
              <Input id='code' type='text' placeholder={pbnT("m1034")} value={code} onChange={e => setCode(e.target.value)} maxLength={6} disabled={isLoading} required />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='password'>{pbnT("m1151")}</Label>
              <Input id='password' type='password' placeholder={pbnT("m1222")} value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} required />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='confirmPassword'>{pbnT("m1153")}</Label>
              <Input id='confirmPassword' type='password' placeholder={pbnT("m1154")} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} required />
            </div>
          </div>

          <div className='flex gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => {
          setStep(1);
          setCode('');
          setPassword('');
          setConfirmPassword('');
          setError('');
          setSuccess('');
          setCaptchaToken('');
        }} disabled={isLoading} className='flex-1'>{pbnT("m1030")}</Button>
            <Button type='submit' className='flex-1' disabled={isLoading}>
              {isLoading ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m1223")}</> : <>
                  <Lock className='h-4 w-4' />{pbnT("m1224")}</>}
            </Button>
          </div>
        </form>}
    </div>;
}
