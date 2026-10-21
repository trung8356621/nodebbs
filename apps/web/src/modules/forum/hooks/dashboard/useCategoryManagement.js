'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { categoryApi } from '@/lib/api';
import { confirm } from '@/components/common/ConfirmPopover';
import { toast } from 'sonner';
const DEFAULT_FORM = {
  name: '',
  slug: '',
  description: '',
  color: '#3B82F6',
  parentId: null,
  position: 0,
  isPrivate: false,
  isFeatured: false
};

/**
 * 分类管理 Hook（独立，不使用 useAdminList）
 * 管理分类的 CRUD、层级展示和精选排序
 */
export function useCategoryManagement() {
  const pbnT = usePbnTranslations();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [reordering, setReordering] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  // ===== 数据获取 =====
  useEffect(() => {
    fetchCategories();
  }, []);
  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryApi.getAll();
      setCategories(data);
    } catch (err) {
      console.error("Could not load categories:", err);
      toast.error(pbnT("m2364"));
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== 表单操作 =====
  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM);
    setSelectedCategory(null);
  }, []);
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    resetForm();
    setShowDialog(true);
  }, [resetForm]);
  const openEditDialog = useCallback(category => {
    setDialogMode('edit');
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      color: category.color || '#3B82F6',
      parentId: category.parentId || null,
      position: category.position !== undefined ? category.position : 0,
      isPrivate: category.isPrivate || false,
      isFeatured: category.isFeatured || false
    });
    setShowDialog(true);
  }, []);

  // ===== 提交 =====
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error(pbnT("m2365"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        await categoryApi.create(formData);
        toast.success(pbnT("m2366"));
      } else {
        await categoryApi.update(selectedCategory.id, formData);
        toast.success(pbnT("m2367"));
      }
      setShowDialog(false);
      resetForm();
      fetchCategories();
    } catch (err) {
      console.error(`Could not ${dialogMode === 'create' ? "Create" : "Update"} category:`, err);
      toast.error(pbnT("m2369", {
        arg0: dialogMode === 'create' ? pbnT("m209") : pbnT("m877")
      }) + err.message);
    } finally {
      setSubmitting(false);
    }
  }, [formData, dialogMode, selectedCategory, resetForm, fetchCategories]);

  // ===== 删除 =====
  const handleDeleteClick = useCallback(async (e, category) => {
    const confirmed = await confirm(e, {
      title: pbnT("m1797"),
      description: <>{pbnT("m2370")}{category.name}{pbnT("m2371")}{category.topicCount > 0 && <span className='block mt-2 text-destructive'>{pbnT("m2372")}{" "}{category.topicCount}{" "}{pbnT("m2373")}</span>}
          </>,
      confirmText: pbnT("m110"),
      variant: 'destructive',
      confirmDisabled: category.topicCount > 0,
      className: 'w-96'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await categoryApi.delete(category.id);
      toast.success(pbnT("m2374"));
      setSelectedCategory(null);
      fetchCategories();
    } catch (err) {
      console.error("Could not delete category:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setSubmitting(false);
    }
  }, [fetchCategories]);

  // ===== 层级展开 =====
  const flattenCategories = useCallback(cats => {
    const result = [];
    const categoryMap = new Map();
    cats.forEach(cat => categoryMap.set(cat.id, cat));
    const calculateLevel = (catId, visited = new Set()) => {
      if (visited.has(catId)) return 0;
      visited.add(catId);
      const cat = categoryMap.get(catId);
      if (!cat || !cat.parentId) return 0;
      const parent = categoryMap.get(cat.parentId);
      if (!parent) return 0;
      return 1 + calculateLevel(cat.parentId, visited);
    };
    const sortByName = (a, b) => a.name.localeCompare(b.name);
    const addCategoryAndChildren = parentId => {
      const children = cats.filter(cat => parentId === null ? cat.parentId === null || cat.parentId === undefined : cat.parentId === parentId).sort(sortByName);
      children.forEach(cat => {
        const level = calculateLevel(cat.id);
        result.push({
          ...cat,
          level
        });
        addCategoryAndChildren(cat.id);
      });
    };
    addCategoryAndChildren(null);
    return result;
  }, []);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories, flattenCategories]);
  const featuredCategories = useMemo(() => categories.filter(c => c.isFeatured).sort((a, b) => (a.position || 0) - (b.position || 0)), [categories]);

  // ===== 精选排序 =====
  const handleReorder = useCallback(async newOrder => {
    setReordering(true);
    try {
      const items = newOrder.map((id, index) => ({
        id,
        position: index
      }));
      await categoryApi.batchReorder(items);
      toast.success(pbnT("m1781"));
      fetchCategories();
    } catch (err) {
      console.error("Could not update order:", err);
      toast.error(err.message || pbnT("m1782"));
    } finally {
      setReordering(false);
    }
  }, [fetchCategories]);
  return {
    // 数据
    categories,
    flatCategories,
    featuredCategories,
    loading,
    // Tab
    activeTab,
    setActiveTab,
    // 表单
    showDialog,
    setShowDialog,
    dialogMode,
    selectedCategory,
    submitting,
    formData,
    setFormData,
    reordering,
    // 操作
    openCreateDialog,
    openEditDialog,
    handleSubmit,
    handleDeleteClick,
    handleReorder
  };
}
