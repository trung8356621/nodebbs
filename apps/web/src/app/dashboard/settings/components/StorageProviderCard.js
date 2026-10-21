'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { storageConfigApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Check, HardDrive, Database, Server, Plus, Trash2 } from 'lucide-react';
import { ConfigProviderCard } from './ConfigProviderCard';
import { FormDialog } from '@/components/common/FormDialog';
import { confirm } from '@/components/common/ConfirmPopover';
import { Loading } from '@/components/common/Loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProviderSettings } from '@/hooks/dashboard/useProviderSettings';
import { useProviderCard } from '@/hooks/dashboard/useProviderCard';
const TYPE_ICONS = {
  local: HardDrive,
  s3: Database
};

// 可创建的存储类型（排除 local）
const STORAGE_TYPES = (pbnT = pbnRuntimeT) => [{
  value: 's3',
  label: pbnT("m704"),
  description: pbnT("m705")
}];
export function StorageSettings() {
  const pbnT = usePbnTranslations();
  const {
    providers,
    setProviders,
    loading,
    editingProvider: editingSlug,
    setEditingProvider: setEditingSlug,
    testingProvider: testingSlug,
    setTestingProvider: setTestingSlug,
    updateProvider,
    fetchProviders
  } = useProviderSettings({
    fetchFn: storageConfigApi.getAllProviders,
    idField: 'slug',
    exclusiveEnable: true,
    errorMessage: pbnT("m706")
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProvider, setNewProvider] = useState({
    slug: '',
    type: 's3',
    displayName: ''
  });
  const handleCreate = async () => {
    if (!newProvider.slug || !newProvider.displayName) {
      toast.error(pbnT("m707"));
      return;
    }
    try {
      setCreating(true);
      await storageConfigApi.createProvider({
        slug: newProvider.slug,
        type: newProvider.type,
        displayName: newProvider.displayName
      });
      toast.success(pbnT("m708"));
      const createdSlug = newProvider.slug;
      setShowCreateForm(false);
      setNewProvider({
        slug: '',
        type: 's3',
        displayName: ''
      });
      await fetchProviders();
      setEditingSlug(createdSlug);
    } catch (error) {
      console.error('Failed to create storage provider:', error);
      toast.error(error.message || pbnT("m709"));
    } finally {
      setCreating(false);
    }
  };
  const handleDelete = async (e, slug) => {
    const confirmed = await confirm(e, {
      title: pbnT("m710"),
      description: pbnT("m711"),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await storageConfigApi.deleteProvider(slug);
      toast.success(pbnT("m712"));
      setProviders(prev => prev.filter(p => p.slug !== slug));
      if (editingSlug === slug) {
        setEditingSlug(null);
      }
    } catch (error) {
      console.error('Failed to delete storage provider:', error);
      toast.error(error.message || pbnT("m249"));
    }
  };
  if (loading) {
    return <Loading text={pbnT("m71")} className='min-h-50' />;
  }
  return <div className='space-y-4'>
      <div className='flex items-start justify-between gap-4 mb-4'>
        <div className='text-sm text-muted-foreground'>{pbnT("m713")}</div>
        <Button variant='outline' size='sm' className='shrink-0' onClick={() => setShowCreateForm(true)}>
          <Plus className='h-4 w-4' />{pbnT("m714")}</Button>
      </div>

      {providers.map(provider => <StorageProviderCard key={provider.id} provider={provider} onUpdate={updateProvider} onDelete={handleDelete} editingSlug={editingSlug} setEditingSlug={setEditingSlug} testingSlug={testingSlug} setTestingSlug={setTestingSlug} />)}

      <FormDialog open={showCreateForm} onOpenChange={open => {
      setShowCreateForm(open);
      if (!open) setNewProvider({
        slug: '',
        type: 's3',
        displayName: ''
      });
    }} title={pbnT("m715")} description={pbnT("m716")} submitText={pbnT("m209")} onSubmit={handleCreate} loading={creating} disabled={!newProvider.slug || !newProvider.displayName}>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='new-provider-type'>{pbnT("m717")}</Label>
            <Select value={newProvider.type} onValueChange={value => setNewProvider({
            ...newProvider,
            type: value
          })}>
              <SelectTrigger id='new-provider-type'>
                <SelectValue placeholder={pbnT("m718")} />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_TYPES(pbnT).map(t => <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-provider-slug'>{pbnT("m719")}</Label>
            <Input id='new-provider-slug' value={newProvider.slug} onChange={e => setNewProvider({
            ...newProvider,
            slug: e.target.value
          })} placeholder={pbnT("m720")} />
            <p className='text-xs text-muted-foreground'>{pbnT("m721")}</p>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='new-provider-name'>{pbnT("m722")}</Label>
            <Input id='new-provider-name' value={newProvider.displayName} onChange={e => setNewProvider({
            ...newProvider,
            displayName: e.target.value
          })} placeholder={pbnT("m723")} />
            <p />
          </div>
        </div>
      </FormDialog>
    </div>;
}
function StorageProviderCard({
  provider,
  onUpdate,
  onDelete,
  editingSlug,
  setEditingSlug,
  testingSlug,
  setTestingSlug
}) {
  const pbnT = usePbnTranslations();
  const config = provider.config || {};
  const isS3 = provider.type === 's3';
  const isLocal = provider.type === 'local';
  const Icon = TYPE_ICONS[provider.type] || Server;
  const getInitialFormData = useCallback(p => {
    const cfg = p.config || {};
    return {
      isEnabled: p.isEnabled,
      stripExif: cfg.stripExif !== false,
      // S3
      accessKeyId: cfg.accessKeyId || '',
      secretAccessKey: cfg.secretAccessKey || '',
      bucket: cfg.bucket || '',
      region: cfg.region || '',
      endpoint: cfg.endpoint || '',
      customDomain: cfg.customDomain || '',
      forcePathStyle: cfg.forcePathStyle || false,
      usePresignedUpload: cfg.usePresignedUpload !== false
    };
  }, []);
  const buildSavePayload = useCallback((formData, p) => {
    const configPayload = {};
    const pIsLocal = p.type === 'local';
    const pIsS3 = p.type === 's3';
    if (pIsLocal) {
      configPayload.stripExif = formData.stripExif;
    }
    if (pIsS3) {
      configPayload.accessKeyId = formData.accessKeyId;
      configPayload.secretAccessKey = formData.secretAccessKey;
      configPayload.bucket = formData.bucket;
      configPayload.region = formData.region;
      configPayload.endpoint = formData.endpoint || null;
      configPayload.forcePathStyle = formData.forcePathStyle;
      configPayload.customDomain = formData.customDomain || null;
      configPayload.usePresignedUpload = formData.usePresignedUpload;
      configPayload.stripExif = formData.stripExif;
    }
    return {
      isEnabled: formData.isEnabled,
      config: configPayload
    };
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
    handleToggleEnabled,
    handleTest
  } = useProviderCard({
    provider,
    idField: 'slug',
    updateApiFn: (slug, payload) => storageConfigApi.updateProvider(slug, payload),
    onUpdate,
    getInitialFormData,
    buildSavePayload,
    editingProvider: editingSlug,
    setEditingProvider: setEditingSlug,
    testApiFn: slug => storageConfigApi.testProvider(slug),
    testingProvider: testingSlug,
    setTestingProvider: setTestingSlug
  });
  const getSummary = () => {
    if (isS3) {
      return config.bucket ? <div className='flex flex-col gap-1'>
          <div>Bucket: {config.bucket}</div>
          <div className='opacity-80'>{pbnT("e18")}{" "}{config.region}</div>
          {config.endpoint && <div className='opacity-80'>Endpoint: {config.endpoint}</div>}
          {config.customDomain && <div className='opacity-80'>CDN: {config.customDomain}</div>}
        </div> : null;
    }
    return null;
  };
  return <ConfigProviderCard title={provider.displayName} description={isS3 ? provider.slug : null} icon={Icon} isEnabled={provider.isEnabled} isEditing={isEditing} onToggleEnabled={handleToggleEnabled} {...(isS3 || isLocal) && {
    onEditClick: handleEditClick,
    onCancelClick: handleCancelClick
  }} summary={getSummary()}>
      {isLocal && <div className='space-y-4 pt-2'>
          <div className='flex items-center justify-between'>
            <div>
              <Label htmlFor={`${provider.slug}-stripExif`}>{pbnT("m724")}</Label>
              <p className='text-xs text-muted-foreground'>{pbnT("m725")}</p>
            </div>
            <Switch id={`${provider.slug}-stripExif`} checked={formData.stripExif} onCheckedChange={checked => setFormData({
          ...formData,
          stripExif: checked
        })} />
          </div>

          <div className='flex items-center gap-2 pt-2 border-t border-border'>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                  <Check className='h-4 w-4' />{pbnT("m587")}</>}
            </Button>
          </div>
        </div>}

      {isS3 && <div className='space-y-4 pt-2'>

          {/* ========== S3 兼容存储配置 ========== */}
          <div className='space-y-2'>
            <Label htmlFor={`${provider.slug}-accessKeyId`}>Access Key ID *</Label>
            <Input id={`${provider.slug}-accessKeyId`} value={formData.accessKeyId} onChange={e => setFormData({
          ...formData,
          accessKeyId: e.target.value
        })} placeholder='Access Key ID' />
          </div>

          <div className='space-y-2'>
            <Label htmlFor={`${provider.slug}-secretAccessKey`}>Secret Access Key *</Label>
            <Input id={`${provider.slug}-secretAccessKey`} type='password' value={formData.secretAccessKey} onChange={e => setFormData({
          ...formData,
          secretAccessKey: e.target.value
        })} placeholder='Secret Access Key' />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor={`${provider.slug}-bucket`}>Bucket *</Label>
              <Input id={`${provider.slug}-bucket`} value={formData.bucket} onChange={e => setFormData({
            ...formData,
            bucket: e.target.value
          })} placeholder='your-bucket' />
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`${provider.slug}-region`}>{pbnT("e19")}</Label>
              <Input id={`${provider.slug}-region`} value={formData.region} onChange={e => setFormData({
            ...formData,
            region: e.target.value
          })} placeholder='us-east-1' />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor={`${provider.slug}-endpoint`}>Endpoint</Label>
            <Input id={`${provider.slug}-endpoint`} value={formData.endpoint} onChange={e => setFormData({
          ...formData,
          endpoint: e.target.value
        })} placeholder={pbnT("m726")} />
            <p className='text-xs text-muted-foreground'>{pbnT("m727")}</p>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label htmlFor={`${provider.slug}-forcePathStyle`}>{pbnT("m728")}</Label>
              <p className='text-xs text-muted-foreground'>{pbnT("m729")}</p>
            </div>
            <Switch id={`${provider.slug}-forcePathStyle`} checked={formData.forcePathStyle} onCheckedChange={checked => setFormData({
          ...formData,
          forcePathStyle: checked
        })} />
          </div>

          <div className='space-y-2'>
            <Label htmlFor={`${provider.slug}-customDomain`}>{pbnT("m730")}</Label>
            <Input id={`${provider.slug}-customDomain`} value={formData.customDomain} onChange={e => setFormData({
          ...formData,
          customDomain: e.target.value
        })} placeholder='https://cdn.example.com' />
            <p className='text-xs text-muted-foreground'>{pbnT("m731")}</p>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label htmlFor={`${provider.slug}-usePresignedUpload`}>{pbnT("m732")}</Label>
              <p className='text-xs text-muted-foreground'>{pbnT("m733")}</p>
            </div>
            <Switch id={`${provider.slug}-usePresignedUpload`} checked={formData.usePresignedUpload} onCheckedChange={checked => setFormData({
          ...formData,
          usePresignedUpload: checked
        })} />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label htmlFor={`${provider.slug}-stripExif`}>{pbnT("m724")}</Label>
              <p className='text-xs text-muted-foreground'>
                {formData.usePresignedUpload ? pbnT("m734") : pbnT("m735")}
              </p>
            </div>
            <Switch id={`${provider.slug}-stripExif`} checked={formData.stripExif} disabled={formData.usePresignedUpload} onCheckedChange={checked => setFormData({
          ...formData,
          stripExif: checked
        })} />
          </div>

          {/* 操作按钮 */}
          <div className='flex items-center gap-2 pt-2 border-t border-border'>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m229")}</> : <>
                  <Check className='h-4 w-4' />{pbnT("m587")}</>}
            </Button>
            <Button variant='outline' onClick={handleTest} disabled={isTesting}>
              {isTesting ? <>
                  <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m648")}</> : pbnT("m736")}
            </Button>

            {/* 删除按钮（仅 S3 类型可删除） */}
            <Button variant='ghost' size='sm' className='ml-auto text-destructive hover:text-destructive hover:bg-destructive/10' onClick={e => onDelete(e, provider.slug)} disabled={provider.isEnabled} title={provider.isEnabled ? pbnT("m737") : pbnT("m738")}>
              <Trash2 className='h-4 w-4' />{pbnT("m110")}</Button>
          </div>
        </div>}
    </ConfigProviderCard>;
}
