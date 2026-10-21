'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import UserAvatar from '@/components/user/UserAvatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, Calendar, Save, Loader2, Edit } from 'lucide-react';
import Time from '@/components/common/Time';
import { useProfileInfo } from '@/hooks/profile/useProfileInfo';
import { useUsernameChange } from '@/hooks/profile/useUsernameChange';
import { useSettings } from '@/contexts/SettingsContext';
import { UsernameChangeDialog } from './UsernameChangeDialog';
import { AvatarUpload } from './AvatarUpload';
import { LinkedAccountsCard } from './LinkedAccountsCard';
import { usePermission } from '@/hooks/usePermission';

/**
 * 个人资料 Tab
 * 内部管理表单状态，消费 useProfileInfo Hook
 *
 * @param {Function} [onGoToSecurity] - 跳转到安全设置 Tab（无密码用户设置密码的引导）
 */
export function ProfileTab({
  onGoToSecurity
}) {
  const pbnT = usePbnTranslations();
  const {
    settings
  } = useSettings();
  const {
    hasPermission,
    isAdmin
  } = usePermission();

  // 使用独立 Hooks
  const {
    user,
    formData,
    pending,
    updateField,
    resetForm,
    updateAvatar,
    // New function
    handleSubmit,
    loading
  } = useProfileInfo();
  const usernameChange = useUsernameChange();

  // 检查是否有头像上传权限
  const canUploadAvatar = useMemo(() => {
    if (isAdmin) return true;
    return hasPermission('upload.avatars');
  }, [isAdmin, hasPermission]);
  if (!user) return null;
  return <>
      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* 个人资料 */}
        <div className='bg-card border border-border rounded-lg overflow-hidden'>
          <div className='px-4 py-3 bg-muted border-b border-border'>
            <h3 className='text-sm font-medium text-card-foreground'>{pbnT("m1112")}</h3>
          </div>
          <div className='p-6 space-y-6'>
            {/* 头像 */}
            <div className={`flex space-x-4`}>
              <UserAvatar url={formData.avatar} name={user.name || user.username} size="xl" />
              {canUploadAvatar ? <div className='flex-1'>
                  <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m261")}</Label>
                  <AvatarUpload onUpload={updateAvatar} />
                  {pending?.avatar && <p className='text-xs text-amber-600 mt-1'>{pbnT("m1113")}</p>}
                </div> : null}
            </div>

            {/* 用户名 */}
            <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m883")}</Label>
              <div className='flex items-center gap-2'>
                <Input type='text' value={user.username} disabled className='bg-muted flex-1' />
                {(settings.allow_username_change?.value || user.needsUsernameSetup) && <Button type='button' variant='outline' size='sm' onClick={usernameChange.openDialog} disabled={!user.needsUsernameSetup && !usernameChange.usernameInfo?.canChange}>
                    <Edit className='h-4 w-4' />
                    {user.needsUsernameSetup ? pbnT("m1114") : pbnT("m1115")}
                  </Button>}
              </div>
              {user.needsUsernameSetup ? <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1116")}</p> : settings.allow_username_change?.value ? <p className='text-xs text-muted-foreground mt-1'>
                  {usernameChange.usernameInfo?.canChange ? <>
                      {usernameChange.usernameInfo.remainingChanges >= 0 ? pbnT("m1117", {
                  arg0: usernameChange.usernameInfo.remainingChanges
                }) : pbnT("m1118")}
                      {usernameChange.usernameInfo.cooldownDays > 0 && pbnT("m1119", {
                  arg0: usernameChange.usernameInfo.cooldownDays
                })}
                    </> : usernameChange.usernameInfo?.nextAvailable ? pbnT("m1120", {
                arg0: usernameChange.usernameInfo.nextAvailable.toLocaleDateString(pbnT.locale)
              }) : pbnT("m1121")}
                </p> : <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1122")}</p>}
            </div>

            {/* 昵称 */}
            <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1123")}</Label>
              <Input type='text' value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder={pbnT("m1124")} maxLength={30} required />
              {pending?.name && <p className='text-xs text-amber-600 mt-1'>{pbnT("m1125")}<span className='font-medium'>{pending.name.value}</span>{pbnT("m1126")}</p>}
            </div>

            {/* 个人简介 */}
            <div>
              <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1127")}</Label>
              <Textarea value={formData.bio} onChange={e => updateField('bio', e.target.value)} rows={3} placeholder={pbnT("m1128")} className='resize-none' />
              {pending?.bio && <p className='text-xs text-amber-600 mt-1'>{pbnT("m1129")}</p>}
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className='flex items-center justify-end space-x-3'>
          <Button type='button' variant='outline' onClick={resetForm}>{pbnT("m1130")}</Button>
          <Button type='submit' disabled={loading}>
            {loading ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                <Save className='h-4 w-4' />{pbnT("m1111")}</>}
          </Button>
        </div>
      </form>

      {/* 账户信息 */}
      <div className='bg-card border border-border rounded-lg overflow-hidden mt-6'>
        <div className='px-4 py-3 bg-muted border-b border-border'>
          <h3 className='text-sm font-medium text-card-foreground'>{pbnT("m1131")}</h3>
        </div>
        <div className='p-6 space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2 text-sm text-muted-foreground'>
              <Calendar className='h-4 w-4' />
              <span>{pbnT("m1132")}</span>
            </div>
            <span className='text-sm text-card-foreground'>
              <Time date={user.createdAt} />
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2 text-sm text-muted-foreground'>
              <User className='h-4 w-4' />
              <span>{pbnT("m1133")}</span>
            </div>
            <Badge variant='secondary'>#{user.id}</Badge>
          </div>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2 text-sm text-muted-foreground'>
              <User className='h-4 w-4' />
              <span>{pbnT("m1134")}</span>
            </div>
            <Badge variant='outline'>
              {user.displayRole?.name || (user.isAdmin ? pbnT("m1135") : pbnT("m70"))}
            </Badge>
          </div>
        </div>
      </div>

      {/* 关联账号 */}
      <LinkedAccountsCard onGoToSecurity={onGoToSecurity} />

      {/* 用户名修改对话框 */}
      <UsernameChangeDialog open={usernameChange.showDialog} onOpenChange={usernameChange.setShowDialog} usernameChange={usernameChange} />
    </>;
}
