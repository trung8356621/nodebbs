'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormDialog } from '@/components/common/FormDialog';

/**
 * 用户名修改对话框
 * 接收 usernameChange Hook 实例
 */
export function UsernameChangeDialog({
  open,
  onOpenChange,
  usernameChange
}) {
  const pbnT = usePbnTranslations();
  const {
    user,
    settings,
    formData,
    setFormData,
    handleSubmit,
    loading,
    usernameInfo
  } = usernameChange;
  const isInitialSetup = user?.needsUsernameSetup;
  return <FormDialog open={open} onOpenChange={onOpenChange} title={isInitialSetup ? pbnT("m1114") : pbnT("m1162")} description={isInitialSetup ? <span>{pbnT("m1163")}</span> : <span>
            {usernameInfo?.cooldownDays > 0 && pbnT("m1164", {
      arg0: usernameInfo.cooldownDays
    })}
            {usernameInfo?.remainingChanges >= 0 && pbnT("m1165", {
      arg0: usernameInfo.remainingChanges
    })}
          </span>} submitText={loading ? isInitialSetup ? pbnT("m1155") : pbnT("m1156") : isInitialSetup ? pbnT("m1166") : pbnT("m869")} onSubmit={handleSubmit} loading={loading} onCancel={() => {
    onOpenChange(false);
    setFormData({
      newUsername: '',
      password: ''
    });
  }} maxWidth="sm:max-w-125">
        <div className='space-y-4 py-4'>
          <div>
            <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1167")}</Label>
            <Input value={user?.username} disabled className='bg-muted' />
          </div>
          <div>
            <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1168")}</Label>
            <Input value={formData.newUsername} onChange={e => setFormData({
          ...formData,
          newUsername: e.target.value
        })} placeholder={pbnT("m1169")} disabled={loading} />
          </div>
          {!isInitialSetup && settings.username_change_requires_password?.value && <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1037")}</Label>
              <Input type='password' value={formData.password} onChange={e => setFormData({
          ...formData,
          password: e.target.value
        })} placeholder={pbnT("m1170")} disabled={loading} />
            </div>}
        </div>
    </FormDialog>;
}
