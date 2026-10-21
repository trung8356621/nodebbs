'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconUpload } from '@/components/common/IconUpload';
import { Switch } from '@/components/ui/switch';
import { SettingSection, SettingItem } from '@/components/common/SettingLayout';
export function GeneralSettings({
  settings,
  handleChange,
  handleInputBlur,
  saving
}) {
  const pbnT = usePbnTranslations();
  return <div className='space-y-6'>
      <SettingSection title={pbnT("m617")} description={pbnT("m618")}>
        {settings.site_name && <SettingItem title={pbnT("m619")} description={pbnT("m619")} layout="vertical">
            <div className="flex flex-col gap-3 w-full">
              <Input id='site_name' defaultValue={settings.site_name.value} onBlur={e => handleInputBlur('site_name', e)} disabled={saving} className='w-full max-w-xl' />
              {settings.show_logo_text && <div className='flex items-center space-x-2'>
                  <Label htmlFor='show_logo_text' className='text-xs font-normal cursor-pointer text-muted-foreground'>
                    {pbnT("e20")}
                  </Label>
                  <Switch id='show_logo_text' checked={settings.show_logo_text.value === true} onCheckedChange={checked => handleChange('show_logo_text', checked)} disabled={saving} className="scale-90" />
                </div>}
            </div>
          </SettingItem>}

        {settings.site_description && <SettingItem title={pbnT("m620")} description={pbnT("m620")} layout="vertical">
            <Textarea id='site_description' defaultValue={settings.site_description.value} onBlur={e => handleInputBlur('site_description', e)} disabled={saving} className='w-full max-w-xl min-h-20 resize-y' />
          </SettingItem>}

        {settings.site_url && <SettingItem title={pbnT("m621")} description={pbnT("m621")} layout="vertical">
            <Input id='site_url' defaultValue={settings.site_url.value} onBlur={e => handleInputBlur('site_url', e)} disabled={saving} className='w-full max-w-xl' placeholder='https://example.com' />
          </SettingItem>}

        {settings.site_keywords && <SettingItem title={pbnT("m622")} description={pbnT("m622")} layout="vertical">
            <Textarea id='site_keywords' defaultValue={settings.site_keywords.value} onBlur={e => handleInputBlur('site_keywords', e)} disabled={saving} className='w-full max-w-xl min-h-20 resize-y' placeholder={pbnT("m623")} />
          </SettingItem>}
      </SettingSection>

      <SettingSection title={pbnT("m624")} description={pbnT("m625")}>
        <div className='p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-6'>
          <div className='space-y-3'>
            <Label className='text-sm font-medium'>Logo</Label>
            <IconUpload value={settings.site_logo?.value || ''} onChange={url => handleChange('site_logo', url)} placeholder='/logo.svg' accept='image/svg+xml,image/png,image/jpeg,image/webp' hint={pbnT("m626")} />
          </div>

          <div className='space-y-3'>
            <Label className='text-sm font-medium'>Favicon</Label>
            <IconUpload value={settings.site_favicon?.value || ''} onChange={url => handleChange('site_favicon', url)} placeholder='/favicon.ico' accept='image/x-icon,image/png,image/vnd.microsoft.icon' hint={pbnT("m627")} />
          </div>

          <div className='space-y-3'>
            <Label className='text-sm font-medium'>Apple Touch Icon</Label>
            <IconUpload value={settings.site_apple_touch_icon?.value || ''} onChange={url => handleChange('site_apple_touch_icon', url)} placeholder='/apple-touch-icon.png' accept='image/png' hint={pbnT("m628")} />
          </div>
        </div>
      </SettingSection>

      <SettingSection title={pbnT("m629")} description={pbnT("m630")}>
        {settings.site_analytics_scripts && <SettingItem title={pbnT("m631")} description={pbnT("m632") || pbnT("m632")} layout="vertical">
            <Textarea id='site_analytics_scripts' defaultValue={settings.site_analytics_scripts.value} onBlur={e => handleInputBlur('site_analytics_scripts', e)} disabled={saving} className='w-full min-h-35 font-mono text-xs resize-y' placeholder='<script>...</script>' />
          </SettingItem>}

        {settings.site_footer_html && <SettingItem title={pbnT("m633")} description={pbnT("m634") || pbnT("m634")} layout="vertical">
            <Textarea id='site_footer_html' defaultValue={settings.site_footer_html.value} onBlur={e => handleInputBlur('site_footer_html', e)} disabled={saving} className='w-full min-h-35 font-mono text-xs resize-y' placeholder='<span>...</span>' />
          </SettingItem>}
      </SettingSection>
    </div>;
}
