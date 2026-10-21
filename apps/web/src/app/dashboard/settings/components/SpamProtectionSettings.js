'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function SpamProtectionSettings({
  settings,
  handleChange,
  handleInputBlur,
  saving
}) {
  const pbnT = usePbnTranslations();
  if (!settings.spam_protection_enabled) return null;
  return <div className='space-y-6'>
      <SettingSection description={pbnT("m691")}>
        {settings.spam_protection_enabled && <SettingItem title={pbnT("m692")} description={pbnT("m691")}>
            <Switch id='spam_protection_enabled' checked={settings.spam_protection_enabled.value} onCheckedChange={checked => handleChange('spam_protection_enabled', checked)} disabled={saving} />
          </SettingItem>}

        {settings.spam_protection_enabled?.value && <>
            {settings.spam_protection_api_key && <SettingItem title={pbnT("m693")} description={<span>{pbnT("m694")}{' '}
                    <a href='https://www.stopforumspam.com/keys' target='_blank' rel='noopener noreferrer' className='text-primary hover:underline'>
                      StopForumSpam
                    </a>
                    {' '}{pbnT("m695")}</span>}>
                <Input id='spam_protection_api_key' type='text' placeholder={pbnT("m696")} defaultValue={settings.spam_protection_api_key.value} onBlur={e => handleInputBlur('spam_protection_api_key', e)} disabled={saving} className='w-64 font-mono text-sm' />
              </SettingItem>}

            {settings.spam_protection_check_ip && <SettingItem title={pbnT("m697")} description={pbnT("m698")}>
                <Switch id='spam_protection_check_ip' checked={settings.spam_protection_check_ip.value} onCheckedChange={checked => handleChange('spam_protection_check_ip', checked)} disabled={saving} />
              </SettingItem>}

            {settings.spam_protection_check_email && <SettingItem title={pbnT("m699")} description={pbnT("m700")}>
                <Switch id='spam_protection_check_email' checked={settings.spam_protection_check_email.value} onCheckedChange={checked => handleChange('spam_protection_check_email', checked)} disabled={saving} />
              </SettingItem>}

            {settings.spam_protection_check_username && <SettingItem title={pbnT("m701")} description={pbnT("m702")}>
                <Switch id='spam_protection_check_username' checked={settings.spam_protection_check_username.value} onCheckedChange={checked => handleChange('spam_protection_check_username', checked)} disabled={saving} />
              </SettingItem>}

            <SettingItem layout="vertical" className="bg-transparent">
              <Alert className="bg-muted/50 w-full">
                <InfoIcon className='h-4 w-4' />
                <AlertDescription className="text-muted-foreground">{pbnT("m703")}</AlertDescription>
              </Alert>
            </SettingItem>
          </>}
      </SettingSection>
    </div>;
}
