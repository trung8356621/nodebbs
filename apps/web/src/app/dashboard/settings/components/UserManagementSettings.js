'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function UserManagementSettings({
  settings,
  handleChange,
  handleInputBlur,
  saving
}) {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <SettingSection title={pbnT("m739")} description={pbnT("m740")}>
        {settings.allow_username_change && <SettingItem title={pbnT("m741")} description={pbnT("m741")}>
            <Switch id='allow_username_change' checked={settings.allow_username_change.value} onCheckedChange={checked => handleChange('allow_username_change', checked)} disabled={saving} />
          </SettingItem>}

        {settings.username_change_cooldown_days && <SettingItem title={pbnT("m742")} description={pbnT("m742")}>
            <Input key={`cooldown-${settings.username_change_cooldown_days.value}`} id='username_change_cooldown_days' type='number' min='0' className='w-32' defaultValue={settings.username_change_cooldown_days.value} onBlur={e => handleInputBlur('username_change_cooldown_days', e)} disabled={saving} />
          </SettingItem>}

        {settings.username_change_limit && <SettingItem title={pbnT("m743")} description={pbnT("m744")}>
            <Input key={`limit-${settings.username_change_limit.value}`} id='username_change_limit' type='number' min='0' className='w-32' defaultValue={settings.username_change_limit.value} onBlur={e => handleInputBlur('username_change_limit', e)} disabled={saving} />
          </SettingItem>}

        {settings.username_change_requires_password && <SettingItem title={pbnT("m745")} description={pbnT("m745")}>
            <Switch id='username_change_requires_password' checked={settings.username_change_requires_password.value} onCheckedChange={checked => handleChange('username_change_requires_password', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m746")} description={pbnT("m747")}>
        {settings.reserved_usernames && <SettingItem layout="vertical">
            <Textarea key={`reserved-${settings.reserved_usernames.value}`} id='reserved_usernames' className='w-full h-64 resize-y overflow-y-auto field-sizing-fixed font-mono text-sm' defaultValue={settings.reserved_usernames.value} onBlur={e => handleInputBlur('reserved_usernames', e)} disabled={saving} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m748")} description={pbnT("m749")}>
        {settings.allow_email_change && <SettingItem title={pbnT("m750")} description={pbnT("m750")}>
            <Switch id='allow_email_change' checked={settings.allow_email_change.value} onCheckedChange={checked => handleChange('allow_email_change', checked)} disabled={saving} />
          </SettingItem>}

        {settings.email_change_requires_password && <SettingItem title={pbnT("m751")} description={pbnT("m751")}>
            <Switch id='email_change_requires_password' checked={settings.email_change_requires_password.value} onCheckedChange={checked => handleChange('email_change_requires_password', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m752")} description={pbnT("m753")}>
        {settings.allow_phone_change && <SettingItem title={pbnT("m754")} description={pbnT("m754")}>
            <Switch id='allow_phone_change' checked={settings.allow_phone_change.value} onCheckedChange={checked => handleChange('allow_phone_change', checked)} disabled={saving} />
          </SettingItem>}

        {settings.phone_change_requires_password && <SettingItem title={pbnT("m755")} description={pbnT("m755")}>
            <Switch id='phone_change_requires_password' checked={settings.phone_change_requires_password.value} onCheckedChange={checked => handleChange('phone_change_requires_password', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m756")} description={pbnT("m757")}>
        {settings.oauth_unlink_requires_password && <SettingItem title={pbnT("m758")} description={pbnT("m758")}>
            <Switch id='oauth_unlink_requires_password' checked={settings.oauth_unlink_requires_password.value} onCheckedChange={checked => handleChange('oauth_unlink_requires_password', checked)} disabled={saving} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m759")} description={pbnT("m760")}>
        {settings.account_deletion_enabled && <SettingItem title={pbnT("m761")} description={pbnT("m761")}>
            <Switch id='account_deletion_enabled' checked={settings.account_deletion_enabled.value} onCheckedChange={checked => handleChange('account_deletion_enabled', checked)} disabled={saving} />
          </SettingItem>}

        {settings.account_deletion_cooldown_days && <SettingItem title={pbnT("m762")} description={pbnT("m760")}>
            <Input key={`deletion-cooldown-${settings.account_deletion_cooldown_days.value}`} id='account_deletion_cooldown_days' type='number' min='0' className='w-32' defaultValue={settings.account_deletion_cooldown_days.value} onBlur={e => handleInputBlur('account_deletion_cooldown_days', e)} disabled={saving} />
          </SettingItem>}
      </SettingSection>
    </div>;
}
