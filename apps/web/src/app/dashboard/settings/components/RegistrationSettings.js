'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function RegistrationSettings({
  settings,
  handleChange,
  saving
}) {
  const pbnT = usePbnTranslations();
  if (!settings.registration_mode) return null;
  return <div className='space-y-6'>
      <SettingSection>
        <SettingItem title={pbnT("m659")} description={pbnT("m659")} layout="responsive">
          <Select value={settings.registration_mode.value} onValueChange={value => handleChange('registration_mode', value)} disabled={saving}>
            <SelectTrigger className='w-full sm:w-48'>
              <SelectValue>
                {settings.registration_mode.value === 'open' && pbnT("m660")}
                {settings.registration_mode.value === 'invitation' && pbnT("m196")}
                {settings.registration_mode.value === 'closed' && pbnT("m661")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='open'>
                <div className='flex items-center gap-2'>
                  <span>🌐</span>
                  <div>
                    <div className='font-medium'>{pbnT("m660")}</div>
                    <div className='text-xs text-muted-foreground'>{pbnT("m662")}</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value='invitation'>
                <div className='flex items-center gap-2'>
                  <span>🎫</span>
                  <div>
                    <div className='font-medium'>{pbnT("m663")}</div>
                    <div className='text-xs text-muted-foreground'>{pbnT("m664")}</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value='closed'>
                <div className='flex items-center gap-2'>
                  <span>🔒</span>
                  <div>
                    <div className='font-medium'>{pbnT("m661")}</div>
                    <div className='text-xs text-muted-foreground'>{pbnT("m665")}</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingItem>
      </SettingSection>
    </div>;
}
