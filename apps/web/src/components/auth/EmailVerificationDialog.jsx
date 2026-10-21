'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { FormDialog } from '@/components/common/FormDialog';
import { Mail, Loader2, Send } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 邮箱验证对话框 - 可复用组件
 * 用于邮箱验证流程：发送验证码 -> 输入验证码 -> 完成验证
 */
export function EmailVerificationDialog({
  open,
  onOpenChange,
  user,
  onVerified
}) {
  const pbnT = usePbnTranslations();
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // 发送验证码
  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      const data = await authApi.sendCode(user.email, 'email_verify');
      toast.success(data.message || pbnT("m1201"));
      setCodeSent(true);
    } catch (err) {
      toast.error(err.message || pbnT("m1202"));
    } finally {
      setIsSendingCode(false);
    }
  };

  // 验证邮箱
  const handleVerifyEmail = async () => {
    if (!verificationCode.trim()) {
      toast.error(pbnT("m1203"));
      return;
    }
    setIsVerifying(true);
    try {
      const data = await authApi.verifyEmail(verificationCode);
      toast.success(data.message || pbnT("m1204"));
      handleCloseDialog();
      // 调用回调通知父组件刷新用户信息
      if (onVerified) {
        onVerified();
      }
    } catch (err) {
      toast.error(err.message || pbnT("m1205"));
    } finally {
      setIsVerifying(false);
    }
  };

  // 关闭对话框时重置状态
  const handleCloseDialog = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    setCodeSent(false);
    setVerificationCode('');
  };

  // 处理弹窗打开状态变化
  const handleOpenChange = newOpen => {
    // 如果已发送验证码，阻止通过点击遮罩关闭弹窗
    if (!newOpen && codeSent) {
      return;
    }
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    // 如果关闭弹窗，重置状态
    if (!newOpen) {
      setCodeSent(false);
      setVerificationCode('');
    }
  };
  return <FormDialog open={open} onOpenChange={handleOpenChange} title={pbnT("m1200")} description={pbnT("m1206")} maxWidth="sm:max-w-[425px]" footer={<DialogFooter className="shrink-0 p-6 pt-4">
          <Button type='button' variant='outline' onClick={handleCloseDialog} disabled={isSendingCode || isVerifying}>{pbnT("m486")}</Button>

          {!codeSent ? <Button type='button' onClick={handleSendCode} disabled={isSendingCode}>
              {isSendingCode ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m615")}</> : <>
                  <Send className='h-4 w-4' />{pbnT("m1026")}</>}
            </Button> : <div className='flex gap-2'>
              <Button type='button' variant='ghost' onClick={handleSendCode} disabled={isSendingCode} size='sm'>
                {isSendingCode ? pbnT("m615") : pbnT("m1207")}
              </Button>
              <Button type='button' onClick={handleVerifyEmail} disabled={isVerifying || !verificationCode.trim()}>
                {isVerifying ? <>
                    <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m1208")}</> : pbnT("m1142")}
              </Button>
            </div>}
        </DialogFooter>}>
        <div className='space-y-4 py-4'>
          <div className='p-3 bg-muted rounded-lg'>
            <div className='flex items-center gap-2'>
              <Mail className='h-4 w-4 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>{pbnT("m1209")}<span className='font-medium text-card-foreground ml-1'>
                  {user?.email}
                </span>
              </p>
            </div>
          </div>

          {!codeSent ? <p className='text-sm text-muted-foreground'>{pbnT("m1210")}</p> : <div className='space-y-3'>
              <div className='p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
                <p className='text-sm text-green-800 dark:text-green-200'>{pbnT("m1211")}</p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='verificationCode'>{pbnT("m1033")}</Label>
                <Input id='verificationCode' type='text' placeholder={pbnT("m1034")} value={verificationCode} onChange={e => setVerificationCode(e.target.value)} maxLength={6} disabled={isVerifying} />
              </div>
            </div>}
        </div>
    </FormDialog>;
}
