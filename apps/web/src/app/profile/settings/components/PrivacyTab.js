'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, MessageSquare, Eye } from 'lucide-react';
import { usePrivacySettings } from '@/hooks/profile/usePrivacySettings';

/**
 * 隐私设置 Tab
 * 内部使用 usePrivacySettings Hook 管理状态
 */
export function PrivacyTab() {
  const pbnT = usePbnTranslations();
  const {
    formData,
    updateField,
    handleSubmit,
    loading
  } = usePrivacySettings();
  return <form onSubmit={handleSubmit} className='space-y-6'>
      <div className='bg-card border border-border rounded-lg overflow-hidden'>
        <div className='px-4 py-3 bg-muted border-b border-border'>
          <h3 className='text-sm font-medium text-card-foreground'>{pbnT("m1094")}</h3>
        </div>
        <div className='p-6 space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='flex-1 mr-4'>
              <div className='flex items-center space-x-2 mb-1'>
                <MessageSquare className='h-4 w-4 text-muted-foreground' />
                <Label className='text-sm font-medium text-card-foreground'>{pbnT("m1095")}</Label>
              </div>
              <p className='text-xs text-muted-foreground'>{pbnT("m1096")}</p>
            </div>
            <Select value={formData.messagePermission} onValueChange={value => updateField('messagePermission', value)}>
              <SelectTrigger>
                <SelectValue placeholder={pbnT("m1097")}>
                  {formData.messagePermission === 'everyone' && pbnT("m1098")}
                  {formData.messagePermission === 'followers' && pbnT("m1099")}
                  {formData.messagePermission === 'disabled' && pbnT("m304")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align='end'>
                <SelectItem value='everyone'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m1098")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1100")}</span>
                  </div>
                </SelectItem>
                <SelectItem value='followers'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m1099")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1101")}</span>
                  </div>
                </SelectItem>
                <SelectItem value='disabled'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m304")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1102")}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center justify-between'>
            <div className='flex-1 mr-4'>
              <div className='flex items-center space-x-2 mb-1'>
                <Eye className='h-4 w-4 text-muted-foreground' />
                <Label className='text-sm font-medium text-card-foreground'>{pbnT("m1103")}</Label>
              </div>
              <p className='text-xs text-muted-foreground'>{pbnT("m1104")}</p>
            </div>
            <Select value={formData.contentVisibility} onValueChange={value => updateField('contentVisibility', value)}>
              <SelectTrigger>
                <SelectValue placeholder={pbnT("m1097")}>
                  {formData.contentVisibility === 'everyone' && pbnT("m1105")}
                  {formData.contentVisibility === 'authenticated' && pbnT("m1106")}
                  {formData.contentVisibility === 'private' && pbnT("m1107")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align='end'>
                <SelectItem value='everyone'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m1105")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1108")}</span>
                  </div>
                </SelectItem>
                <SelectItem value='authenticated'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m1106")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1109")}</span>
                  </div>
                </SelectItem>
                <SelectItem value='private'>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{pbnT("m1107")}</span>
                    <span className='text-xs text-muted-foreground'>{pbnT("m1110")}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className='flex items-center justify-end'>
        <Button type='submit' disabled={loading}>
          {loading ? <>
              <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
              <Save className='h-4 w-4' />{pbnT("m1111")}</>}
        </Button>
      </div>
    </form>;
}
