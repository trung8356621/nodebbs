'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { oauthConfigApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Check, Globe } from 'lucide-react';
import { ConfigProviderCard } from './ConfigProviderCard';
import { Loading } from '@/components/common/Loading';
import { useProviderSettings } from '@/hooks/dashboard/useProviderSettings';
import { useProviderCard } from '@/hooks/dashboard/useProviderCard';
export function OAuthSettings() {
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
    fetchFn: oauthConfigApi.getAllProviders,
    exclusiveEnable: false,
    errorMessage: pbnT("m638")
  });
  if (loading) {
    return <Loading text={pbnT("m71")} className='min-h-50' />;
  }
  return <div className='space-y-4'>
      <div className='text-sm text-muted-foreground mb-4'>{pbnT("m639")}</div>

      {providers.map(provider => <OAuthProviderCard key={provider.id} provider={provider} onUpdate={updateProvider} editingProvider={editingProvider} setEditingProvider={setEditingProvider} testingProvider={testingProvider} setTestingProvider={setTestingProvider} />)}
    </div>;
}

// 解析 additionalConfig
const parseAdditionalConfig = config => {
  try {
    return config ? JSON.parse(config) : {};
  } catch {
    return {};
  }
};
function OAuthProviderCard({
  provider,
  onUpdate,
  editingProvider,
  setEditingProvider,
  testingProvider,
  setTestingProvider
}) {
  const pbnT = usePbnTranslations();
  const getInitialFormData = useCallback(p => {
    const additional = parseAdditionalConfig(p.additionalConfig);
    return {
      isEnabled: p.isEnabled,
      clientId: p.clientId || '',
      clientSecret: p.clientSecret || '',
      callbackUrl: p.callbackUrl || '',
      scope: p.scope || '',
      // Apple 特有配置
      teamId: additional.teamId || '',
      keyId: additional.keyId || ''
    };
  }, []);
  const buildSavePayload = useCallback((formData, p) => {
    const payload = {
      isEnabled: formData.isEnabled,
      clientId: formData.clientId,
      clientSecret: formData.clientSecret,
      callbackUrl: formData.callbackUrl,
      scope: formData.scope
    };

    // 对 Apple 特殊处理 additionalConfig
    if (p.provider === 'apple') {
      payload.additionalConfig = JSON.stringify({
        teamId: formData.teamId,
        keyId: formData.keyId
      });
    }
    return payload;
  }, []);
  const {
    formData,
    setFormData,
    saving,
    isEditing,
    isTesting,
    handleEditClick,
    handleCancelClick,
    handleSave,
    handleToggleEnabled: baseHandleToggleEnabled,
    handleTest
  } = useProviderCard({
    provider,
    idField: 'provider',
    updateApiFn: (id, payload) => oauthConfigApi.updateProvider(id, payload),
    onUpdate,
    getInitialFormData,
    buildSavePayload,
    editingProvider,
    setEditingProvider,
    testApiFn: providerId => oauthConfigApi.testProvider(providerId),
    testingProvider,
    setTestingProvider
  });

  // OAuth toggle: when disabling, also set isDefault: false
  const handleToggleEnabled = useCallback(async checked => {
    if (!checked) {
      try {
        const payload = {
          isEnabled: false,
          isDefault: false
        };
        await oauthConfigApi.updateProvider(provider.provider, payload);
        toast.success(pbnT("m640", {
          arg0: provider.displayName
        }));
        onUpdate(provider.provider, payload);
      } catch (error) {
        console.error(`Failed to toggle provider ${provider.provider}:`, error);
        toast.error(pbnT("m568"));
      }
    } else {
      baseHandleToggleEnabled(checked);
    }
  }, [baseHandleToggleEnabled, provider.provider, provider.displayName, onUpdate]);

  // 准备 summary 内容
  const summaryContent = provider.clientId ? <div className='flex flex-col gap-1'>
      <div>Client ID: {provider.clientId.substring(0, 20)}...</div>
      {provider.callbackUrl && <div className='opacity-80'>{pbnT("m641")}{" "}{provider.callbackUrl}</div>}
    </div> : null;
  return <ConfigProviderCard title={provider.displayName} icon={Globe} isEnabled={provider.isEnabled} isEditing={isEditing} onToggleEnabled={handleToggleEnabled} onEditClick={handleEditClick} onCancelClick={handleCancelClick} summary={summaryContent}>
      <div className='space-y-4 pt-2'>
        <div className='space-y-2'>
          <Label htmlFor={`${provider.provider}-clientId`}>
            {provider.provider === 'apple' ? 'Service ID (Client ID) *' : 'Client ID *'}
          </Label>
          <Input id={`${provider.provider}-clientId`} value={formData.clientId} onChange={e => setFormData({
          ...formData,
          clientId: e.target.value
        })} placeholder={pbnT("m642")} />
        </div>

        <div className='space-y-2'>
          <Label htmlFor={`${provider.provider}-clientSecret`}>
              {provider.provider === 'apple' ? 'Private Key (.p8 Content) *' : 'Client Secret *'}
          </Label>
          {provider.provider === 'apple' ? <Textarea id={`${provider.provider}-clientSecret`} value={formData.clientSecret} onChange={e => setFormData({
          ...formData,
          clientSecret: e.target.value
        })} placeholder='-----BEGIN PRIVATE KEY----- ...' rows={4} className="font-mono text-xs" /> : <Input id={`${provider.provider}-clientSecret`} type='password' value={formData.clientSecret} onChange={e => setFormData({
          ...formData,
          clientSecret: e.target.value
        })} placeholder={pbnT("m643")} />}
        </div>

        {provider.provider === 'apple' && <div className="grid grid-cols-2 gap-4">
              <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-teamId`}>Team ID *</Label>
              <Input id={`${provider.provider}-teamId`} value={formData.teamId} onChange={e => setFormData({
            ...formData,
            teamId: e.target.value
          })} placeholder={pbnT("e14")} />
            </div>
              <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-keyId`}>Key ID *</Label>
              <Input id={`${provider.provider}-keyId`} value={formData.keyId} onChange={e => setFormData({
            ...formData,
            keyId: e.target.value
          })} placeholder={pbnT("e15")} />
            </div>
          </div>}

        {/* 微信小程序不需要回调 URL 和权限范围 */}
        {provider.provider !== 'wechat_miniprogram' && <>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-callbackUrl`}>{pbnT("m644")}</Label>
              <Input id={`${provider.provider}-callbackUrl`} value={formData.callbackUrl} onChange={e => setFormData({
            ...formData,
            callbackUrl: e.target.value
          })} placeholder={provider.provider === 'apple' ? `${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/oauth/apple/callback` : `${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/auth/${provider.provider}/callback`} />
              <p className='text-xs text-muted-foreground'>{pbnT("m645")}</p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-scope`}>{pbnT("m646")}</Label>
              <Textarea id={`${provider.provider}-scope`} value={formData.scope} onChange={e => setFormData({
            ...formData,
            scope: e.target.value
          })} placeholder={pbnT("m647")} rows={2} />
            </div>
          </>}

        <div className='flex items-center gap-2 pt-2'>
          <Button onClick={handleSave} disabled={saving || !formData.clientId || !formData.clientSecret}>
            {saving ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                <Check className='h-4 w-4' />{pbnT("m587")}</>}
          </Button>
          <Button variant='outline' onClick={handleTest} disabled={isTesting || !provider.clientId}>
            {isTesting ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m648")}</> : pbnT("m649")}
          </Button>
        </div>
      </div>
    </ConfigProviderCard>;
}
