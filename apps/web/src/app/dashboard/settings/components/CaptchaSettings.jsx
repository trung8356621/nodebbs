'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { captchaConfigApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Shield, X, Info } from 'lucide-react';
import { ConfigProviderCard } from './ConfigProviderCard';
import { Loading } from '@/components/common/Loading';

// 验证场景配置
const CAPTCHA_SCENES = (pbnT = pbnRuntimeT) => [{
  key: 'register',
  label: pbnT("m559"),
  description: pbnT("m560")
}, {
  key: 'login',
  label: pbnT("m561"),
  description: pbnT("m562")
}, {
  key: 'passwordReset',
  label: pbnT("m0"),
  description: pbnT("m563")
}];

/**
 * CAPTCHA 设置页面
 */
export function CaptchaSettings() {
  const pbnT = usePbnTranslations();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState(null);

  // 获取提供商配置
  const fetchProviders = async () => {
    try {
      const data = await captchaConfigApi.getProviders();
      setProviders(data);
    } catch (error) {
      toast.error(pbnT("m488"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchProviders();
  }, []);

  // 更新单个 provider
  const updateProvider = (providerName, updates) => {
    setProviders(prev => prev.map(p => {
      // 如果当前更新启用了某个 provider，则禁用其他 provider
      if (updates.isEnabled && p.provider !== providerName) {
        return {
          ...p,
          isEnabled: false
        };
      }
      // 更新目标 provider
      if (p.provider === providerName) {
        return {
          ...p,
          ...updates
        };
      }
      return p;
    }));
  };
  if (loading) {
    return <Loading text={pbnT("m71")} className="min-h-50" />;
  }
  return <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
        <Info className="h-4 w-4" />
        <span>{pbnT("m564")}</span>
      </div>

      <div className="grid gap-4">
        {providers.map(provider => <CaptchaProviderCard key={provider.provider} provider={provider} onUpdate={updateProvider} editingProvider={editingProvider} setEditingProvider={setEditingProvider} />)}
      </div>
    </div>;
}

/**
 * 单个 CAPTCHA 提供商配置卡片
 */
function CaptchaProviderCard({
  provider,
  onUpdate,
  editingProvider,
  setEditingProvider
}) {
  const pbnT = usePbnTranslations();
  const isEditing = editingProvider === provider.provider;
  const [formData, setFormData] = useState({
    isEnabled: provider.isEnabled || false,
    config: provider.config || {},
    enabledScenes: provider.enabledScenes || {}
  });
  const [saving, setSaving] = useState(false);

  // 重置表单数据
  useEffect(() => {
    setFormData({
      isEnabled: provider.isEnabled || false,
      config: provider.config || {},
      enabledScenes: provider.enabledScenes || {}
    });
  }, [provider]);

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await captchaConfigApi.updateProvider(provider.provider, formData);
      onUpdate(provider.provider, result);
      toast.success(pbnT("m565"));
      setEditingProvider(null);
    } catch (error) {
      toast.error(pbnT("m495"));
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async checked => {
    try {
      const payload = {
        isEnabled: checked
      };
      await captchaConfigApi.updateProvider(provider.provider, payload);
      onUpdate(provider.provider, payload);
      setFormData(prev => ({
        ...prev,
        isEnabled: checked
      }));
      toast.success(checked ? pbnT("m566") : pbnT("m567"));
    } catch (error) {
      toast.error(pbnT("m568"));
      console.error(error);
    }
  };

  // 更新 config 字段
  const updateConfig = (key, value) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  // 更新 enabledScenes
  const updateScene = (scene, enabled) => {
    setFormData(prev => ({
      ...prev,
      enabledScenes: {
        ...prev.enabledScenes,
        [scene]: enabled
      }
    }));
  };

  // 获取配置概览
  const getConfigSummary = () => {
    const config = provider.config || {};
    if (provider.provider === 'cap') {
      return config.apiEndpoint ? `API: ${config.apiEndpoint}` : pbnT("m569");
    }
    if (config.siteKey) {
      return `Site Key: ${config.siteKey.substring(0, 20)}...`;
    }
    return '';
  };
  const summaryContent = provider.config && getConfigSummary() ? <div className="text-xs text-muted-foreground">
      {getConfigSummary()}
    </div> : null;
  const description = provider.provider === 'recaptcha' ? pbnT("m570") : provider.provider === 'hcaptcha' ? pbnT("m571") : provider.provider === 'turnstile' ? pbnT("m572") : provider.provider === 'cap' ? pbnT("m573") : '';
  return <ConfigProviderCard title={provider.displayName} description={description} icon={Shield} isEnabled={provider.isEnabled} isEditing={isEditing} onToggleEnabled={handleToggleEnabled} onEditClick={() => {
    setEditingProvider(provider.provider);
    setFormData({
      isEnabled: provider.isEnabled || false,
      config: provider.config || {},
      enabledScenes: provider.enabledScenes || {}
    });
  }} onCancelClick={() => {
    setEditingProvider(null);
  }} summary={summaryContent}>
      <div className="space-y-4 pt-2">

        {/* 基础配置 - Site Key & Secret Key */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Site Key {provider.provider !== 'cap' && '*'}</Label>
            <Input value={formData.config.siteKey || ''} onChange={e => updateConfig('siteKey', e.target.value)} placeholder={pbnT("m574")} />
          </div>
          <div className="space-y-2">
            <Label>Secret Key {provider.provider !== 'cap' && '*'}</Label>
            <Input type="password" value={formData.config.secretKey || ''} onChange={e => updateConfig('secretKey', e.target.value)} placeholder={pbnT("m575")} />
          </div>
        </div>

        {/* reCAPTCHA 特有配置 */}
        {provider.provider === 'recaptcha' && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{pbnT("m576")}</Label>
              <Select value={formData.config.version || 'v2'} onValueChange={v => updateConfig('version', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v2">{pbnT("m577")}</SelectItem>
                  <SelectItem value="v3">{pbnT("m578")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.config.version === 'v3' && <div className="space-y-2">
                <Label>{pbnT("m579")}</Label>
                <Input type="number" step="0.1" min="0" max="1" value={formData.config.scoreThreshold || 0.5} onChange={e => updateConfig('scoreThreshold', parseFloat(e.target.value))} />
              </div>}
          </div>}

        {/* Turnstile 特有配置 */}
        {provider.provider === 'turnstile' && <div className="space-y-2">
            <Label>{pbnT("m580")}</Label>
            <Select value={formData.config.mode || 'managed'} onValueChange={v => updateConfig('mode', v)}>
              <SelectTrigger className="w-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="managed">{pbnT("m581")}</SelectItem>
                <SelectItem value="non-interactive">{pbnT("m582")}</SelectItem>
                <SelectItem value="invisible">{pbnT("m583")}</SelectItem>
              </SelectContent>
            </Select>
          </div>}

        {/* Cap 特有配置 */}
        {provider.provider === 'cap' && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{pbnT("m584")}</Label>
              <Input value={formData.config.apiEndpoint || ''} onChange={e => updateConfig('apiEndpoint', e.target.value)} placeholder="http://localhost:3000/[SiteKey]/" />
              <p className="text-xs text-muted-foreground">

              </p>
            </div>
            <div className="space-y-2">
              <Label>{pbnT("m585")}</Label>
              <Input type="number" min="4" max="8" value={formData.config.difficulty || 4} onChange={e => updateConfig('difficulty', parseInt(e.target.value))} />
            </div>
          </div>}

        {/* 启用场景 */}
        <div className="space-y-3">
          <Label>{pbnT("m586")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAPTCHA_SCENES(pbnT).map(scene => <div key={scene.key} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                <div>
                  <span className="text-sm font-medium">{scene.label}</span>
                  <p className="text-xs text-muted-foreground">{scene.description}</p>
                </div>
                <Switch checked={formData.enabledScenes[scene.key] || false} onCheckedChange={checked => updateScene(scene.key, checked)} />
              </div>)}
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{pbnT("m587")}</Button>
        </div>
      </div>
    </ConfigProviderCard>;
}
export default CaptchaSettings;
