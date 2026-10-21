'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/contexts/SettingsContext';
import { webhookConfigApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
const AVAILABLE_EVENTS = (pbnT = pbnRuntimeT) => [{
  value: 'topic.created',
  label: pbnT("m763"),
  description: pbnT("m764")
}, {
  value: 'post.created',
  label: pbnT("m765"),
  description: pbnT("m766")
}, {
  value: 'post.liked',
  label: pbnT("m767"),
  description: pbnT("m768")
}, {
  value: 'user.checkin',
  label: pbnT("m769"),
  description: pbnT("m770")
}, {
  value: 'user.deletion_requested',
  label: pbnT("m771"),
  description: pbnT("m772")
}, {
  value: 'user.deleted',
  label: pbnT("m773"),
  description: pbnT("m774")
}];
export function WebhookSettings() {
  const pbnT = usePbnTranslations();
  const {
    settings,
    updateSetting
  } = useSettings();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => {
    const cfg = settings?.webhook_config?.value || {};
    return {
      enabled: cfg.enabled || false,
      url: cfg.url || '',
      secret: cfg.secret || '',
      events: Array.isArray(cfg.events) ? cfg.events : [],
      retryCount: cfg.retryCount ?? 3,
      timeout: cfg.timeout ?? 5000
    };
  });
  const handleTest = async () => {
    if (!formData.url) {
      toast.error(pbnT("m775"));
      return;
    }
    try {
      setTesting(true);
      await webhookConfigApi.testWebhook(formData.url, formData.secret);
      toast.success(pbnT("m776"));
    } catch (error) {
      toast.error(error.message || pbnT("m777"));
    } finally {
      setTesting(false);
    }
  };
  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSetting('webhook_config', formData);
      toast.success(pbnT("m778"));
    } catch (error) {
      toast.error(pbnT("m495"));
    } finally {
      setSaving(false);
    }
  };
  const toggleEvent = eventValue => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue) ? prev.events.filter(e => e !== eventValue) : [...prev.events, eventValue]
    }));
  };
  return <div className='space-y-6'>
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>{pbnT("m779")}</AlertDescription>
      </Alert>

      <div className='space-y-4 border rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <Label>{pbnT("m780")}</Label>
            <p className='text-sm text-muted-foreground'>{pbnT("m781")}</p>
          </div>
          <Switch checked={formData.enabled} onCheckedChange={checked => setFormData({
          ...formData,
          enabled: checked
        })} />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='webhook-url'>Webhook URL *</Label>
          <Input id='webhook-url' type='url' placeholder='https://your-domain.com/webhook' value={formData.url} onChange={e => setFormData({
          ...formData,
          url: e.target.value
        })} autoComplete='off' />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='webhook-secret'>{pbnT("m782")}</Label>
          <Input id='webhook-secret' type='password' placeholder={pbnT("m783")} value={formData.secret} onChange={e => setFormData({
          ...formData,
          secret: e.target.value
        })} autoComplete='new-password' />
          <p className='text-xs text-muted-foreground'>{pbnT("m784")}</p>
        </div>

        <div className='space-y-3'>
          <Label>{pbnT("m785")}</Label>
          <div className='space-y-2'>
            {AVAILABLE_EVENTS(pbnT).map(event => <div key={event.value} className='flex items-start space-x-2'>
                <Checkbox id={event.value} checked={formData.events.includes(event.value)} onCheckedChange={() => toggleEvent(event.value)} />
                <div className='grid gap-1 leading-none'>
                  <label htmlFor={event.value} className='text-sm font-medium cursor-pointer'>
                    {event.label}
                  </label>
                  <p className='text-xs text-muted-foreground'>{event.description}</p>
                </div>
              </div>)}
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='retry-count'>{pbnT("m786")}</Label>
            <Input id='retry-count' type='number' min='0' max='10' value={formData.retryCount} onChange={e => {
            const val = parseInt(e.target.value, 10);
            setFormData({
              ...formData,
              retryCount: isNaN(val) ? 3 : Math.min(Math.max(val, 0), 10)
            });
          }} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='timeout'>{pbnT("m787")}</Label>
            <Input id='timeout' type='number' min='1000' max='30000' step='1000' value={formData.timeout} onChange={e => {
            const val = parseInt(e.target.value, 10);
            setFormData({
              ...formData,
              timeout: isNaN(val) ? 5000 : Math.min(Math.max(val, 1000), 30000)
            });
          }} />
          </div>
        </div>

        <div className='flex gap-2 pt-4'>
          <Button onClick={handleTest} disabled={testing || !formData.url} variant='outline'>
            {testing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{pbnT("m736")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{pbnT("m587")}</Button>
        </div>
      </div>
    </div>;
}
