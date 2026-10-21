'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * 单个 Provider Card 管理 Hook
 * 管理表单状态、保存、启用/禁用、测试操作
 *
 * @param {Object} options
 * @param {Object} options.provider - Provider 数据对象
 * @param {string} options.idField - 唯一标识字段名 ('provider' | 'slug')
 * @param {Function} options.updateApiFn - async (id, payload) => void
 * @param {Function} options.onUpdate - (id, updates) => void 乐观更新回调
 * @param {Function} options.getInitialFormData - (provider) => formData
 * @param {Function} options.buildSavePayload - (formData, provider) => API payload
 * @param {string} options.editingProvider - 当前正在编辑的 provider ID
 * @param {Function} options.setEditingProvider - 设置编辑状态
 * @param {Function} [options.testApiFn] - async (id, ...args) => { success, message }
 * @param {string} [options.testingProvider] - 当前正在测试的 provider ID
 * @param {Function} [options.setTestingProvider] - 设置测试状态
 */
export function useProviderCard({
  provider,
  idField = 'provider',
  updateApiFn,
  onUpdate,
  getInitialFormData,
  buildSavePayload,
  editingProvider,
  setEditingProvider,
  testApiFn,
  testingProvider,
  setTestingProvider
}) {
  const pbnT = usePbnTranslations();
  const providerId = provider[idField];
  const isEditing = editingProvider === providerId;
  const isTesting = testingProvider === providerId;
  const [formData, setFormData] = useState(() => getInitialFormData(provider));
  const [saving, setSaving] = useState(false);
  const handleEditClick = useCallback(() => {
    setEditingProvider(providerId);
    setFormData(getInitialFormData(provider));
  }, [providerId, provider, setEditingProvider, getInitialFormData]);
  const handleCancelClick = useCallback(() => {
    setEditingProvider(null);
  }, [setEditingProvider]);
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const payload = buildSavePayload(formData, provider);
      await updateApiFn(providerId, payload);
      toast.success(pbnT("m2083", {
        arg0: provider.displayName
      }));
      setEditingProvider(null);
      onUpdate(providerId, payload);
    } catch (error) {
      console.error(`Failed to update provider ${providerId}:`, error);
      toast.error(pbnT("m590"));
    } finally {
      setSaving(false);
    }
  }, [formData, provider, providerId, buildSavePayload, updateApiFn, setEditingProvider, onUpdate]);
  const handleToggleEnabled = useCallback(async checked => {
    try {
      const payload = {
        isEnabled: checked
      };
      await updateApiFn(providerId, payload);
      toast.success(checked ? pbnT("m2084", {
        arg0: provider.displayName
      }) : pbnT("m2085", {
        arg0: provider.displayName
      }));
      onUpdate(providerId, payload);
    } catch (error) {
      console.error(`Failed to toggle provider ${providerId}:`, error);
      toast.error(pbnT("m568"));
    }
  }, [providerId, provider.displayName, updateApiFn, onUpdate]);
  const handleTest = useCallback(async (...args) => {
    if (!testApiFn || !setTestingProvider) return;
    try {
      setTestingProvider(providerId);
      const result = await testApiFn(providerId, ...args);
      if (result.success) {
        toast.success(result.message || pbnT("m2086"));
      } else {
        toast.error(result.message || pbnT("m2087"));
      }
    } catch (error) {
      console.error(`Failed to test provider ${providerId}:`, error);
      toast.error(pbnT("m2087"));
    } finally {
      setTestingProvider(null);
    }
  }, [providerId, testApiFn, setTestingProvider]);
  return {
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
  };
}
