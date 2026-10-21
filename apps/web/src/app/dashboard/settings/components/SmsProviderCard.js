'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { smsConfigApi } from '@/lib/api';
import { Loader2, Check, MessageSquareText } from 'lucide-react';
import { ConfigProviderCard } from './ConfigProviderCard';
import { Loading } from '@/components/common/Loading';
import { useProviderSettings } from '@/hooks/dashboard/useProviderSettings';
import { useProviderCard } from '@/hooks/dashboard/useProviderCard';
const getInitialFormData = provider => {
  const cfg = provider.config || {};
  return {
    isEnabled: provider.isEnabled,
    // 阿里云配置
    accessKeyId: cfg.accessKeyId || '',
    accessKeySecret: cfg.accessKeySecret || '',
    signName: cfg.signName || '',
    region: cfg.region || 'cn-hangzhou',
    // 腾讯云配置
    secretId: cfg.secretId || '',
    secretKey: cfg.secretKey || '',
    appId: cfg.appId || '',
    templates: cfg.templates || {}
  };
};
const buildSavePayload = (formData, provider) => {
  const isAliyun = provider.provider === 'aliyun';
  const isTencent = provider.provider === 'tencent';
  return {
    isEnabled: formData.isEnabled,
    config: {
      signName: formData.signName,
      ...(isAliyun && {
        accessKeyId: formData.accessKeyId,
        accessKeySecret: formData.accessKeySecret,
        region: formData.region
      }),
      ...(isTencent && {
        secretId: formData.secretId,
        secretKey: formData.secretKey,
        appId: formData.appId
      }),
      templates: formData.templates
    }
  };
};
export function SmsSettings() {
  const pbnT = usePbnTranslations();
  const {
    providers,
    loading,
    editingProvider,
    setEditingProvider,
    updateProvider
  } = useProviderSettings({
    fetchFn: smsConfigApi.getAllProviders,
    exclusiveEnable: true,
    errorMessage: pbnT("m667")
  });
  if (loading) {
    return <Loading text={pbnT("m71")} className='min-h-50' />;
  }
  if (providers.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>
        <p>{pbnT("m668")}</p>
        <p className='text-sm mt-2'>{pbnT("m669")}</p>
      </div>;
  }
  return <div className='space-y-4'>
      {providers.map(provider => <SmsProviderCard key={provider.id} provider={provider} onUpdate={updateProvider} editingProvider={editingProvider} setEditingProvider={setEditingProvider} />)}
    </div>;
}
function SmsProviderCard({
  provider,
  onUpdate,
  editingProvider,
  setEditingProvider
}) {
  const pbnT = usePbnTranslations();
  const config = provider.config || {};
  const updateApiFn = useCallback((id, payload) => smsConfigApi.updateProvider(id, payload), []);
  const {
    formData,
    setFormData,
    saving,
    isEditing,
    handleEditClick,
    handleCancelClick,
    handleSave,
    handleToggleEnabled
  } = useProviderCard({
    provider,
    idField: 'provider',
    updateApiFn,
    onUpdate,
    getInitialFormData,
    buildSavePayload,
    editingProvider,
    setEditingProvider
  });
  const isAliyun = provider.provider === 'aliyun';
  const isTencent = provider.provider === 'tencent';
  const summaryContent = config.signName ? <div className='flex flex-col gap-1'>
      <div>{pbnT("m670")}{" "}{config.signName}</div>
      {isAliyun && config.region && <div className='opacity-80'>{pbnT("m671")}{" "}{config.region}</div>}
      {isTencent && config.appId && <div className='opacity-80'>{pbnT("m672")}{" "}{config.appId}</div>}
    </div> : null;
  return <ConfigProviderCard title={provider.displayName} icon={MessageSquareText} isEnabled={provider.isEnabled} isEditing={isEditing} onToggleEnabled={handleToggleEnabled} onEditClick={handleEditClick} onCancelClick={handleCancelClick} summary={summaryContent}>
      <div className='space-y-4 pt-2'>

        {/* 签名名称（通用） */}
        <div className='space-y-2'>
          <Label htmlFor={`${provider.provider}-signName`}>{pbnT("m673")}</Label>
          <Input id={`${provider.provider}-signName`} value={formData.signName} onChange={e => setFormData({
          ...formData,
          signName: e.target.value
        })} placeholder={pbnT("m674")} />
          <p className='text-xs text-muted-foreground'>{pbnT("m675")}</p>
        </div>

        {/* 阿里云配置 */}
        {isAliyun && <>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-accessKeyId`}>AccessKey ID *</Label>
              <Input id={`${provider.provider}-accessKeyId`} value={formData.accessKeyId} onChange={e => setFormData({
            ...formData,
            accessKeyId: e.target.value
          })} placeholder={pbnT("m676")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-accessKeySecret`}>AccessKey Secret *</Label>
              <Input id={`${provider.provider}-accessKeySecret`} type='password' value={formData.accessKeySecret} onChange={e => setFormData({
            ...formData,
            accessKeySecret: e.target.value
          })} placeholder={pbnT("m677")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-region`}>{pbnT("m678")}</Label>
              <Input id={`${provider.provider}-region`} value={formData.region} onChange={e => setFormData({
            ...formData,
            region: e.target.value
          })} placeholder='cn-hangzhou' />
            </div>
          </>}

        {/* 腾讯云配置 */}
        {isTencent && <>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-secretId`}>SecretId *</Label>
              <Input id={`${provider.provider}-secretId`} value={formData.secretId} onChange={e => setFormData({
            ...formData,
            secretId: e.target.value
          })} placeholder={pbnT("m679")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-secretKey`}>SecretKey *</Label>
              <Input id={`${provider.provider}-secretKey`} type='password' value={formData.secretKey} onChange={e => setFormData({
            ...formData,
            secretKey: e.target.value
          })} placeholder={pbnT("m680")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-appId`}>{pbnT("m681")}</Label>
              <Input id={`${provider.provider}-appId`} value={formData.appId} onChange={e => setFormData({
            ...formData,
            appId: e.target.value
          })} placeholder={pbnT("m682")} />
            </div>
          </>}

        {/* 模板映射配置 */}
        <div className='space-y-4 pt-4 border-t border-border'>
          <Label className='text-base font-semibold'>{pbnT("m683")}</Label>
          <p className='text-xs text-muted-foreground'>{pbnT("m684")}{isAliyun ? 'TemplateCode' : 'TemplateId'}{pbnT("m685")}</p>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-tpl-login`} className='text-xs text-muted-foreground'>{pbnT("m686")}</Label>
              <Input id={`${provider.provider}-tpl-login`} value={formData.templates?.SMS_LOGIN || ''} onChange={e => setFormData({
              ...formData,
              templates: {
                ...formData.templates,
                SMS_LOGIN: e.target.value
              }
            })} placeholder={pbnT("m687")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-tpl-reset`} className='text-xs text-muted-foreground'>{pbnT("m688")}</Label>
              <Input id={`${provider.provider}-tpl-reset`} value={formData.templates?.SMS_PASSWORD_RESET || ''} onChange={e => setFormData({
              ...formData,
              templates: {
                ...formData.templates,
                SMS_PASSWORD_RESET: e.target.value
              }
            })} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-tpl-bind`} className='text-xs text-muted-foreground'>{pbnT("m689")}</Label>
              <Input id={`${provider.provider}-tpl-bind`} value={formData.templates?.SMS_BIND || ''} onChange={e => setFormData({
              ...formData,
              templates: {
                ...formData.templates,
                SMS_BIND: e.target.value
              }
            })} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.provider}-tpl-change`} className='text-xs text-muted-foreground'>{pbnT("m690")}</Label>
              <Input id={`${provider.provider}-tpl-change`} value={formData.templates?.SMS_CHANGE || ''} onChange={e => setFormData({
              ...formData,
              templates: {
                ...formData.templates,
                SMS_CHANGE: e.target.value
              }
            })} />
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 pt-2'>
          <Button onClick={handleSave} disabled={saving || !formData.signName}>
            {saving ? <>
                <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                <Check className='h-4 w-4' />{pbnT("m587")}</>}
          </Button>
        </div>
      </div>
    </ConfigProviderCard>;
}
