'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Switch } from '@/components/ui/switch';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function SecuritySettings({
  settings,
  handleChange,
  saving
}) {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <SettingSection>
        {settings.email_verification_required && <SettingItem title={pbnT("m666")} description={pbnT("m798")}>
            <Switch id='email_verification_required' checked={settings.email_verification_required.value} onCheckedChange={checked => handleChange('email_verification_required', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>
    </div>;
}
