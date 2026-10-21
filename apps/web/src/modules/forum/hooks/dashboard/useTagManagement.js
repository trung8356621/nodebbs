'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { useAdminList } from '@/hooks/dashboard/useAdminList';
import { tagApi } from '@/lib/api';
import { confirm } from '@/components/common/ConfirmPopover';
import { toast } from 'sonner';

/**
 * 标签管理 Hook
 * 组合 useAdminList，添加标签 CRUD 操作
 */
export function useTagManagement() {
  const pbnT = usePbnTranslations();
  const list = useAdminList({
    fetchFn: params => tagApi.getList(params),
    pageSize: 50
  });

  // ===== 表单状态 =====
  const [showDialog, setShowDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // ===== 表单操作 =====
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: ''
    });
    setSelectedTag(null);
  }, []);
  const openCreateDialog = useCallback(() => {
    resetForm();
    setIsEdit(false);
    setShowDialog(true);
  }, [resetForm]);
  const openEditDialog = useCallback(tag => {
    setSelectedTag(tag);
    setFormData({
      name: tag.name,
      slug: tag.slug,
      description: tag.description || ''
    });
    setIsEdit(true);
    setShowDialog(true);
  }, []);

  // ===== 提交 =====
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error(pbnT("m2382"));
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        const updatedTag = await tagApi.update(selectedTag.id, formData);
        list.updateItem(selectedTag.id, updatedTag);
        toast.success(pbnT("m2383"));
      } else {
        const newTag = await tagApi.create(formData);
        list.prependItem(newTag);
        toast.success(pbnT("m2384"));
      }
      setShowDialog(false);
      resetForm();
    } catch (err) {
      console.error(`Could not ${isEdit ? "Update" : "Create"} tag:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setSubmitting(false);
    }
  }, [formData, isEdit, selectedTag, list, resetForm]);

  // ===== 删除 =====
  const handleDeleteClick = useCallback(async (e, tag) => {
    const confirmed = await confirm(e, {
      title: pbnT("m1797"),
      description: <>{pbnT("m2386")}{tag.name}{pbnT("m2371")}{tag.topicCount > 0 && <span className='block mt-2 text-orange-600'>{pbnT("m2387")}{" "}{tag.topicCount}{" "}{pbnT("m2388")}</span>}
          </>,
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await tagApi.delete(tag.id);
      list.removeItem(tag.id);
      toast.success(pbnT("m2389"));
      setSelectedTag(null);
    } catch (err) {
      console.error("Could not delete tag:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setSubmitting(false);
    }
  }, [list]);
  return {
    ...list,
    // 表单状态
    showDialog,
    setShowDialog,
    isEdit,
    selectedTag,
    submitting,
    formData,
    setFormData,
    // 操作
    openCreateDialog,
    openEditDialog,
    handleSubmit,
    handleDeleteClick
  };
}
