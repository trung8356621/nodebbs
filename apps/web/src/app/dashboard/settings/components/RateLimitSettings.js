'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function RateLimitSettings({
  settings,
  handleChange,
  handleInputBlur,
  saving
}) {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <SettingSection description={pbnT("m650")}>
        {settings.rate_limit_enabled && <SettingItem title={pbnT("m651")} description={pbnT("m650")}>
            <Switch id='rate_limit_enabled' checked={settings.rate_limit_enabled.value} onCheckedChange={checked => handleChange('rate_limit_enabled', checked)} disabled={saving} />
          </SettingItem>}

        {settings.rate_limit_window_ms && <SettingItem title={pbnT("m652")} description={<span>
                {pbnT("m652")}
                <br />
                <span className="text-xs text-muted-foreground/80 mt-1 inline-block">{pbnT("m653")}{" "}{Math.round(settings.rate_limit_window_ms.value / 1000)}{" "}{pbnT("m654")}</span>
              </span>}>
            <Input id='rate_limit_window_ms' type='number' defaultValue={settings.rate_limit_window_ms.value} onBlur={e => handleInputBlur('rate_limit_window_ms', e)} disabled={saving} className='w-32' />
          </SettingItem>}

        {settings.rate_limit_max_requests && <SettingItem title={pbnT("m655")} description={pbnT("m655")}>
            <Input id='rate_limit_max_requests' type='number' defaultValue={settings.rate_limit_max_requests.value} onBlur={e => handleInputBlur('rate_limit_max_requests', e)} disabled={saving} className='w-32' />
          </SettingItem>}

        {settings.rate_limit_auth_multiplier && <SettingItem title={pbnT("m656")} description={<span>
                {pbnT("m656")}
                <br />
                <span className="text-xs text-muted-foreground/80 mt-1 inline-block">{pbnT("m657")}{' '}
                  {settings.rate_limit_max_requests?.value && Math.floor(settings.rate_limit_max_requests.value * settings.rate_limit_auth_multiplier.value)}{' '}{pbnT("m658")}</span>
              </span>}>
            <Input id='rate_limit_auth_multiplier' type='number' step='0.1' defaultValue={settings.rate_limit_auth_multiplier.value} onBlur={e => handleInputBlur('rate_limit_auth_multiplier', e)} disabled={saving} className='w-32' />
          </SettingItem>}
      </SettingSection>
    </div>;
}
