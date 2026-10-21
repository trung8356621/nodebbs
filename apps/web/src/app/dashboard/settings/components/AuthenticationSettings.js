'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function AuthenticationSettings({
  settings,
  handleChange,
  saving
}) {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <SettingSection>
        {settings.qr_login_enabled && <>
            <SettingItem title={pbnT("m553")} description={pbnT("m554")}>
              <Switch id='qr_login_enabled' checked={settings.qr_login_enabled.value} onCheckedChange={checked => handleChange('qr_login_enabled', checked)} disabled={saving} />
            </SettingItem>

            {settings.qr_login_enabled.value && settings.qr_login_timeout && <SettingItem title={pbnT("m555")} description={pbnT("m556")} className="pl-8 sm:pl-10">
                <Input id='qr_login_timeout' type='number' min='60' max='600' className='w-24' value={settings.qr_login_timeout.value} onChange={e => handleChange('qr_login_timeout', e.target.value)} disabled={saving} />
              </SettingItem>}
          </>}

        {settings.phone_login_enabled && <SettingItem title={pbnT("m557")} description={pbnT("m558")}>
            <Switch id='phone_login_enabled' checked={settings.phone_login_enabled.value} onCheckedChange={checked => handleChange('phone_login_enabled', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>
    </div>;
}
