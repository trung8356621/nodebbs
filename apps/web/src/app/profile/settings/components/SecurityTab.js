'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, Lock, Loader2, Edit } from 'lucide-react';
import { EmailVerificationDialog } from '@/components/auth/EmailVerificationDialog';
import { usePasswordChange } from '@/hooks/profile/usePasswordChange';
import { useEmailChange } from '@/hooks/profile/useEmailChange';
import { useBindEmail } from '@/hooks/profile/useBindEmail';
import { useBindPhone } from '@/hooks/profile/useBindPhone';
import { usePhoneChange } from '@/hooks/profile/usePhoneChange';
import { useAccountDeletion } from '@/hooks/profile/useAccountDeletion';
import { useSettings } from '@/contexts/SettingsContext';
import { EmailChangeDialog } from './EmailChangeDialog';
import { BindEmailDialog } from './BindEmailDialog';
import { BindPhoneDialog } from './BindPhoneDialog';
import { PhoneChangeDialog } from './PhoneChangeDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';

/**
 * 安全设置 Tab
 * 邮箱管理、手机号管理、密码修改
 */
export function SecurityTab() {
  const pbnT = usePbnTranslations();
  const {
    settings
  } = useSettings();
  const [showEmailVerifyDialog, setShowEmailVerifyDialog] = useState(false);
  const deletionCooldownDays = settings.account_deletion_cooldown_days?.value || 30;
  const {
    user,
    passwordData,
    updateField,
    handleSubmit,
    onEmailVerified,
    changingPassword
  } = usePasswordChange();
  const emailChange = useEmailChange();
  const bindEmailHook = useBindEmail();
  const bindPhoneHook = useBindPhone();
  const phoneChange = usePhoneChange();
  const accountDeletion = useAccountDeletion();
  if (!user) return null;
  const hasEmail = !!user.email;
  const hasPhone = !!user.phone;
  return <div className='space-y-6'>
      {/* 邮箱管理 */}
      <div className='bg-card border border-border rounded-lg overflow-hidden'>
        <div className='px-4 py-3 bg-muted border-b border-border'>
          <h3 className='text-sm font-medium text-card-foreground'>{pbnT("m1136")}</h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center justify-between'>
            <div className='flex-1 mr-4'>
              <div className='flex items-center space-x-2 mb-1'>
                <Mail className='h-4 w-4 text-muted-foreground' />
                <Label className='text-sm font-medium text-card-foreground'>
                  {hasEmail ? user.email : pbnT("m1137")}
                </Label>
              </div>
              <p className='text-xs text-muted-foreground'>
                {hasEmail ? user.isEmailVerified ? settings.allow_email_change?.value ? pbnT("m1138") : pbnT("m1139") : pbnT("m1140") : pbnT("m1141")}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              {hasEmail ? <>
                  {user.isEmailVerified ? <Badge variant='success' className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>{pbnT("m893")}</Badge> : <>
                      <Badge variant='warning' className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'>{pbnT("m894")}</Badge>
                      <Button type='button' variant='outline' size='sm' onClick={() => setShowEmailVerifyDialog(true)}>
                        <Mail className='h-4 w-4' />{pbnT("m1142")}</Button>
                    </>}
                  {settings.allow_email_change?.value && <Button type='button' variant='outline' size='sm' onClick={emailChange.openDialog}>
                      <Edit className='h-4 w-4' />{pbnT("m1115")}</Button>}
                </> : <Button type='button' variant='outline' size='sm' onClick={bindEmailHook.openDialog}>
                  <Mail className='h-4 w-4' />{pbnT("m1143")}</Button>}
            </div>
          </div>
        </div>
      </div>

      {/* 手机号管理 */}
      {(hasPhone || settings.phone_login_enabled?.value) && <div className='bg-card border border-border rounded-lg overflow-hidden'>
          <div className='px-4 py-3 bg-muted border-b border-border'>
            <h3 className='text-sm font-medium text-card-foreground'>{pbnT("m1144")}</h3>
          </div>
          <div className='p-6'>
            <div className='flex items-center justify-between'>
              <div className='flex-1 mr-4'>
                <div className='flex items-center space-x-2 mb-1'>
                  <Phone className='h-4 w-4 text-muted-foreground' />
                  <Label className='text-sm font-medium text-card-foreground'>
                    {hasPhone ? user.phone : pbnT("m1145")}
                  </Label>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {hasPhone ? settings.allow_phone_change?.value ? pbnT("m1146") : pbnT("m1147") : pbnT("m1148")}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                {hasPhone ? <>
                    {user.isPhoneVerified && <Badge variant='success' className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>{pbnT("m893")}</Badge>}
                    {settings.allow_phone_change?.value && <Button type='button' variant='outline' size='sm' onClick={phoneChange.openDialog}>
                        <Edit className='h-4 w-4' />{pbnT("m1115")}</Button>}
                  </> : <Button type='button' variant='outline' size='sm' onClick={bindPhoneHook.openDialog}>
                    <Phone className='h-4 w-4' />{pbnT("m1041")}</Button>}
              </div>
            </div>
          </div>
        </div>}

      {/* 修改密码 */}
      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='bg-card border border-border rounded-lg overflow-hidden'>
          <div className='px-4 py-3 bg-muted border-b border-border'>
            <h3 className='text-sm font-medium text-card-foreground'>
              {user.hasPassword === false ? pbnT("m1149") : pbnT("m1150")}
            </h3>
          </div>
          <div className='p-6 space-y-4'>
            {user.hasPassword !== false && <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1037")}</Label>
                <Input type='password' value={passwordData.currentPassword} onChange={e => updateField('currentPassword', e.target.value)} placeholder={pbnT("m1059")} />
              </div>}

            <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1151")}</Label>
              <Input type='password' value={passwordData.newPassword} onChange={e => updateField('newPassword', e.target.value)} placeholder={pbnT("m1152")} />
            </div>

            <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1153")}</Label>
              <Input type='password' value={passwordData.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} placeholder={pbnT("m1154")} />
            </div>
          </div>
        </div>

        <div className='flex items-center justify-end'>
          <Button type='submit' disabled={changingPassword}>
            {changingPassword ? <>
                <Loader2 className='h-4 w-4 animate-spin' />
                {user.hasPassword === false ? pbnT("m1155") : pbnT("m1156")}
              </> : <>
                <Lock className='h-4 w-4' />
                {user.hasPassword === false ? pbnT("m1149") : pbnT("m1150")}
              </>}
          </Button>
        </div>
      </form>

      {/* 邮箱验证对话框 */}
      {user.email && <EmailVerificationDialog open={showEmailVerifyDialog} onOpenChange={setShowEmailVerifyDialog} user={user} onVerified={onEmailVerified} />}

      {/* 邮箱修改对话框 */}
      <EmailChangeDialog open={emailChange.showDialog} onOpenChange={emailChange.setShowDialog} emailChange={emailChange} />

      {/* 邮箱绑定对话框 */}
      <BindEmailDialog open={bindEmailHook.showDialog} onOpenChange={bindEmailHook.setShowDialog} bindEmail={bindEmailHook} />

      {/* 手机号修改对话框 */}
      <PhoneChangeDialog open={phoneChange.showDialog} onOpenChange={phoneChange.setShowDialog} phoneChange={phoneChange} />

      {/* 手机号绑定对话框 */}
      <BindPhoneDialog open={bindPhoneHook.showDialog} onOpenChange={bindPhoneHook.setShowDialog} bindPhone={bindPhoneHook} />

      {/* 危险操作 */}
      {user.role !== 'admin' && settings.account_deletion_enabled?.value && <>
          <div className='border border-destructive/50 rounded-lg overflow-hidden'>
            <div className='px-4 py-3 bg-destructive/5 border-b border-destructive/50'>
              <h3 className='text-sm font-medium text-destructive'>{pbnT("m1157")}</h3>
            </div>
            <div className='p-6'>
              <div className='flex items-center justify-between'>
                <div className='flex-1 mr-4'>
                  <p className='text-sm text-card-foreground font-medium mb-1'>{pbnT("m1045")}</p>
                  <p className='text-xs text-muted-foreground'>
                    {deletionCooldownDays > 0 ? pbnT("m1158", {
                  arg0: deletionCooldownDays
                }) : pbnT("m1159")}
                  </p>
                </div>
                <Button variant='destructive' size='sm' onClick={accountDeletion.openDialog}>{pbnT("m1045")}</Button>
              </div>
            </div>
          </div>

          <DeleteAccountDialog open={accountDeletion.showDialog} onOpenChange={accountDeletion.setShowDialog} user={user} onConfirm={accountDeletion.handleConfirm} loading={accountDeletion.loading} cooldownDays={deletionCooldownDays} />
        </>}
    </div>;
}
