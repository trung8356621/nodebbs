'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { emailConfigApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Check, Mail, Trash2 } from 'lucide-react';
import { ConfigProviderCard } from './ConfigProviderCard';
import { Loading } from '@/components/common/Loading';
import { useProviderSettings } from '@/hooks/dashboard/useProviderSettings';
import { useProviderCard } from '@/hooks/dashboard/useProviderCard';

function resolveEncryption(cfg = {}) {
  if (cfg.smtpEncryption) return cfg.smtpEncryption;
  if (cfg.smtpSecure === false) return 'starttls';
  return 'ssl';
}

const getInitialFormData = provider => {
  const cfg = provider.config || {};
  return {
    isEnabled: provider.isEnabled,
    smtpHost: cfg.smtpHost || '',
    smtpPort: cfg.smtpPort || 587,
    smtpEncryption: resolveEncryption(cfg),
    smtpUser: cfg.smtpUser || '',
    smtpPassword: '',
    fromEmail: cfg.fromEmail || '',
    fromName: cfg.fromName || '',
    apiKey: '',
    apiEndpoint: cfg.apiEndpoint || '',
    hasSmtpPassword: Boolean(cfg.hasSmtpPassword),
    hasApiKey: Boolean(cfg.hasApiKey),
    clearSmtpPassword: false,
    clearApiKey: false,
  };
};

const buildSavePayload = (formData, provider) => {
  const isSmtpBased = provider.provider === 'smtp' || provider.provider === 'aliyun';
  const isApiBased = provider.provider === 'sendgrid' || provider.provider === 'resend';
  const config = {
    fromEmail: formData.fromEmail,
    fromName: formData.fromName,
  };

  if (isSmtpBased) {
    config.smtpHost = formData.smtpHost;
    config.smtpPort = formData.smtpPort;
    config.smtpEncryption = formData.smtpEncryption;
    config.smtpSecure = formData.smtpEncryption === 'ssl';
    config.smtpUser = formData.smtpUser;
    if (formData.smtpPassword) {
      config.smtpPassword = formData.smtpPassword;
    }
  }

  if (isApiBased) {
    if (formData.apiKey) {
      config.apiKey = formData.apiKey;
    }
    config.apiEndpoint = formData.apiEndpoint;
  }

  const payload = {
    isEnabled: formData.isEnabled,
    config,
  };

  if (formData.clearSmtpPassword) payload.clearSmtpPassword = true;
  if (formData.clearApiKey) payload.clearApiKey = true;

  return payload;
};

const testApiFn = (providerId, testEmail) => emailConfigApi.testProvider(providerId, testEmail);

export function EmailSettings() {
  const pbnT = usePbnTranslations();
  const {
    providers,
    loading,
    editingProvider,
    setEditingProvider,
    testingProvider,
    setTestingProvider,
    updateProvider
  } = useProviderSettings({
    fetchFn: emailConfigApi.getAllProviders,
    exclusiveEnable: true,
    errorMessage: pbnT("m596")
  });
  if (loading) {
    return <Loading text={pbnT("m71")} className='min-h-50' />;
  }
  return <div className='space-y-4'>
      <div className='text-sm text-muted-foreground mb-4'>{pbnT("m597")}</div>

      {providers.map(provider => <EmailProviderCard key={provider.id} provider={provider} onUpdate={updateProvider} editingProvider={editingProvider} setEditingProvider={setEditingProvider} testingProvider={testingProvider} setTestingProvider={setTestingProvider} />)}
    </div>;
}

function EmailProviderCard({
  provider,
  onUpdate,
  editingProvider,
  setEditingProvider,
  testingProvider,
  setTestingProvider
}) {
  const pbnT = usePbnTranslations();
  const config = provider.config || {};
  const [testEmail, setTestEmail] = useState('');
  const updateApiFn = useCallback((id, payload) => emailConfigApi.updateProvider(id, payload), []);
  const {
    formData,
    setFormData,
    saving,
    isEditing,
    isTesting,
    handleEditClick,
    handleCancelClick,
    handleSave,
    handleToggleEnabled,
    handleTest
  } = useProviderCard({
    provider,
    idField: 'provider',
    updateApiFn,
    onUpdate,
    getInitialFormData,
    buildSavePayload,
    editingProvider,
    setEditingProvider,
    testApiFn,
    testingProvider,
    setTestingProvider
  });
  const isSmtpBased = provider.provider === 'smtp' || provider.provider === 'aliyun';
  const isApiBased = provider.provider === 'sendgrid' || provider.provider === 'resend';
  const onTestClick = () => {
    if (!testEmail) {
      toast.error(pbnT("m598"));
      return;
    }
    handleTest(testEmail);
  };

  const clearSmtpPassword = () => {
    setFormData({
      ...formData,
      smtpPassword: '',
      clearSmtpPassword: true,
      hasSmtpPassword: false,
    });
    toast.message(pbnT("m2488"));
  };

  const clearApiKey = () => {
    setFormData({
      ...formData,
      apiKey: '',
      clearApiKey: true,
      hasApiKey: false,
    });
    toast.message(pbnT("m2488"));
  };

  const summaryContent = config.fromEmail ? <div className='flex flex-col gap-1'>
      <div>{pbnT("m599")}{" "}{config.fromName} &lt;{config.fromEmail}&gt;</div>
      {isSmtpBased && config.smtpHost && <div className='opacity-80'>SMTP: {config.smtpHost}:{config.smtpPort} · {resolveEncryption(config)}</div>}
      {isApiBased && config.hasApiKey && <div className='opacity-80'>API Key: {pbnT("m2489")}</div>}
    </div> : null;

  return <ConfigProviderCard title={provider.displayName} icon={Mail} isEnabled={provider.isEnabled} isEditing={isEditing} onToggleEnabled={handleToggleEnabled} onEditClick={handleEditClick} onCancelClick={handleCancelClick} summary={summaryContent}>
      <div className='space-y-4 pt-2'>

        <div className='space-y-2'>
          <Label htmlFor={`${provider.provider}-fromEmail`}>{pbnT("m600")}</Label>
          <Input id={`${provider.provider}-fromEmail`} type='email' value={formData.fromEmail} onChange={e => setFormData({
          ...formData,
          fromEmail: e.target.value
        })} placeholder='noreply@example.com' />
        </div>

        <div className='space-y-2'>
          <Label htmlFor={`${provider.provider}-fromName`}>{pbnT("m601")}</Label>
          <Input id={`${provider.provider}-fromName`} value={formData.fromName} onChange={e => setFormData({
          ...formData,
          fromName: e.target.value
        })} placeholder={pbnT("m602")} />
        </div>

        {isSmtpBased && <>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-smtpHost`}>{pbnT("m603")}</Label>
              <Input id={`${provider.provider}-smtpHost`} value={formData.smtpHost} onChange={e => setFormData({
            ...formData,
            smtpHost: e.target.value
          })} placeholder='smtp.example.com' />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor={`${provider.provider}-smtpPort`}>{pbnT("m604")}</Label>
                <Input id={`${provider.provider}-smtpPort`} type='number' value={formData.smtpPort} onChange={e => setFormData({
              ...formData,
              smtpPort: parseInt(e.target.value, 10) || ''
            })} placeholder='587' />
              </div>

              <div className='space-y-2'>
                <Label htmlFor={`${provider.provider}-smtpEncryption`}>{pbnT("m605")}</Label>
                <Select value={formData.smtpEncryption} onValueChange={value => setFormData({
              ...formData,
              smtpEncryption: value
            })}>
                  <SelectTrigger id={`${provider.provider}-smtpEncryption`} className='w-full'>
                    <SelectValue placeholder={pbnT("m605")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>{pbnT("m2490")}</SelectItem>
                    <SelectItem value='starttls'>{pbnT("m2491")}</SelectItem>
                    <SelectItem value='ssl'>{pbnT("m2492")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-smtpUser`}>{pbnT("m606")}</Label>
              <Input id={`${provider.provider}-smtpUser`} value={formData.smtpUser} onChange={e => setFormData({
            ...formData,
            smtpUser: e.target.value
          })} placeholder={pbnT("m607")} />
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor={`${provider.provider}-smtpPassword`}>{pbnT("m608")}</Label>
                {formData.hasSmtpPassword && !formData.clearSmtpPassword ? (
                  <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-muted-foreground' onClick={clearSmtpPassword}>
                    <Trash2 className='h-3.5 w-3.5' />
                    {pbnT("m2487")}
                  </Button>
                ) : null}
              </div>
              <Input id={`${provider.provider}-smtpPassword`} type='password' autoComplete='new-password' value={formData.smtpPassword} onChange={e => setFormData({
            ...formData,
            smtpPassword: e.target.value,
            clearSmtpPassword: false,
          })} placeholder={formData.hasSmtpPassword && !formData.clearSmtpPassword ? pbnT("m2314") : pbnT("m609")} />
              {formData.hasSmtpPassword && !formData.clearSmtpPassword && !formData.smtpPassword ? (
                <p className='text-xs text-muted-foreground'>{pbnT("m2489")}</p>
              ) : null}
              {formData.clearSmtpPassword ? (
                <p className='text-xs text-amber-600'>{pbnT("m2488")}</p>
              ) : null}
            </div>
          </>}

        {isApiBased && <>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor={`${provider.provider}-apiKey`}>API Key *</Label>
                {formData.hasApiKey && !formData.clearApiKey ? (
                  <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-muted-foreground' onClick={clearApiKey}>
                    <Trash2 className='h-3.5 w-3.5' />
                    {pbnT("m2487")}
                  </Button>
                ) : null}
              </div>
              <Input id={`${provider.provider}-apiKey`} type='password' autoComplete='new-password' value={formData.apiKey} onChange={e => setFormData({
            ...formData,
            apiKey: e.target.value,
            clearApiKey: false,
          })} placeholder={formData.hasApiKey && !formData.clearApiKey ? pbnT("m2314") : pbnT("m610")} />
              {formData.hasApiKey && !formData.clearApiKey && !formData.apiKey ? (
                <p className='text-xs text-muted-foreground'>{pbnT("m2489")}</p>
              ) : null}
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-apiEndpoint`}>{pbnT("m584")}</Label>
              <Input id={`${provider.provider}-apiEndpoint`} value={formData.apiEndpoint} onChange={e => setFormData({
            ...formData,
            apiEndpoint: e.target.value
          })} placeholder={pbnT("m611")} disabled />
              <p className='text-xs text-muted-foreground'>{pbnT("m612")}</p>
            </div>
          </>}

        <div className='space-y-2 pt-2 border-t border-border'>
          <Label htmlFor={`${provider.provider}-testEmail`}>{pbnT("m613")}</Label>
          <Input id={`${provider.provider}-testEmail`} type='email' value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder={pbnT("m614")} />
        </div>

        <div className='flex items-center gap-2 pt-2'>
          <Button onClick={handleSave} disabled={saving || !formData.fromEmail}>
            {saving ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                <Check className='h-4 w-4' />{pbnT("m587")}</>}
          </Button>
          <Button variant='outline' onClick={onTestClick} disabled={isTesting || !config.fromEmail || !testEmail}>
            {isTesting ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m615")}</> : pbnT("m616")}
          </Button>
        </div>
      </div>
    </ConfigProviderCard>;
}
