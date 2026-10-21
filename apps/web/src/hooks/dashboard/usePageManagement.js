'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { confirm } from '@/components/common/ConfirmPopover';
import { pagesApi } from '@/lib/api';
import { useAdminList } from './useAdminList';
export const PAGE_TYPES = ['html', 'markdown', 'text', 'json'];
const RESERVED_SLUG_PREFIXES = ['api', 'auth', 'dashboard', 'profile', 'create', 'categories', 'tags', 'topic', 'users', 'search', 'about', 'reference', 'uploads', 'docs', '_next', 'not-found-render', 'page-render'];
const DEFAULT_FORM = {
  title: '',
  slug: '',
  type: 'text',
  content: '',
  isPublished: false,
  standalone: false
};
function normalizeSlugInput(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/').toLowerCase();
}
function isReservedSlug(slug) {
  return RESERVED_SLUG_PREFIXES.some(prefix => slug === prefix || slug.startsWith(`${prefix}/`));
}
function validateForm(formData, pbnT = pbnRuntimeT) {
  const normalizedSlug = normalizeSlugInput(formData.slug);
  if (!formData.title.trim()) {
    throw new Error(pbnT("m2063"));
  }
  if (!normalizedSlug) {
    throw new Error(pbnT("m2064"));
  }
  if (!/^[a-z0-9._/-]+$/.test(normalizedSlug)) {
    throw new Error(pbnT("m2065"));
  }
  if (normalizedSlug.includes('..')) {
    throw new Error(pbnT("m2066"));
  }
  if (isReservedSlug(normalizedSlug)) {
    throw new Error(pbnT("m2067"));
  }
  if (!formData.content) {
    throw new Error(pbnT("m399"));
  }
  if (formData.type === 'json') {
    JSON.parse(formData.content);
  }
  return {
    title: formData.title.trim(),
    slug: normalizedSlug,
    type: formData.type,
    content: formData.content,
    isPublished: Boolean(formData.isPublished),
    standalone: Boolean(formData.standalone)
  };
}
export function usePageManagement() {
  const pbnT = usePbnTranslations();
  const list = useAdminList({
    fetchFn: async params => {
      const apiParams = {
        page: params.page,
        limit: params.limit
      };
      if (params.search) {
        apiParams.search = params.search;
      }
      if (params.typeFilter && params.typeFilter !== 'all') {
        apiParams.type = params.typeFilter;
      }
      if (params.statusFilter && params.statusFilter !== 'all') {
        apiParams.status = params.statusFilter;
      }
      return pagesApi.admin.getList(apiParams);
    },
    pageSize: 20,
    debounceMs: 400,
    defaultFilters: {
      typeFilter: 'all',
      statusFilter: 'all'
    }
  });
  const {
    items,
    page,
    filters,
    setPage,
    updateItem,
    removeItem,
    refreshList
  } = list;
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedPage, setSelectedPage] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    setSelectedPage(null);
    setFormData(DEFAULT_FORM);
    setShowDialog(true);
  }, []);
  const openEditDialog = useCallback(pageItem => {
    setDialogMode('edit');
    setSelectedPage(pageItem);
    setFormData({
      title: pageItem.title || '',
      slug: pageItem.slug || '',
      type: pageItem.type || 'text',
      content: pageItem.content || '',
      isPublished: Boolean(pageItem.isPublished),
      standalone: Boolean(pageItem.standalone)
    });
    setShowDialog(true);
  }, []);
  const handleTypeChange = useCallback(value => {
    setFormData(prev => ({
      ...prev,
      type: value,
      ...(!['html', 'markdown'].includes(value) && {
        standalone: false
      })
    }));
  }, []);
  const handleSubmit = useCallback(async () => {
    let payload;
    try {
      payload = validateForm(formData, pbnT);
    } catch (error) {
      toast.error(error instanceof SyntaxError ? pbnT("m2068") : error.message || pbnT("m2069"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        await pagesApi.admin.create(payload);
        toast.success(pbnT("m2070"));
      } else {
        await pagesApi.admin.update(selectedPage.id, payload);
        toast.success(pbnT("m2071"));
      }
      setShowDialog(false);
      setSelectedPage(null);
      setFormData(DEFAULT_FORM);
      refreshList();
    } catch (error) {
      console.error("Could not save page:", error);
      toast.error(error.message || pbnT("m2073"));
    } finally {
      setSubmitting(false);
    }
  }, [dialogMode, formData, refreshList, selectedPage]);
  const handleDelete = useCallback(async (e, pageItem) => {
    const confirmed = await confirm(e, {
      title: pbnT("m2074"),
      description: pbnT("m2075", {
        arg0: pageItem.title
      }),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) {
      return;
    }
    setSubmitting(true);
    try {
      await pagesApi.admin.delete(pageItem.id);
      toast.success(pbnT("m2076"));
      if (items.length === 1 && page > 1) {
        setPage(prev => prev - 1);
      } else {
        removeItem(pageItem.id);
      }
    } catch (error) {
      console.error("Could not delete page:", error);
      toast.error(error.message || pbnT("m2078"));
    } finally {
      setSubmitting(false);
    }
  }, [items.length, page, removeItem, setPage]);
  const handleTogglePublished = useCallback(async (pageItem, nextPublished) => {
    updateItem(pageItem.id, {
      isPublished: nextPublished,
      _statusUpdating: true
    });
    try {
      await pagesApi.admin.update(pageItem.id, {
        isPublished: nextPublished
      });
      if (filters.statusFilter === 'published' && !nextPublished || filters.statusFilter === 'draft' && nextPublished) {
        removeItem(pageItem.id);
      } else {
        updateItem(pageItem.id, {
          isPublished: nextPublished,
          _statusUpdating: false
        });
      }
      toast.success(nextPublished ? pbnT("m2079") : pbnT("m2080"));
    } catch (error) {
      console.error("Could not change page status:", error);
      toast.error(error.message || pbnT("m2082"));
      updateItem(pageItem.id, {
        isPublished: pageItem.isPublished,
        _statusUpdating: false
      });
    }
  }, [filters.statusFilter, removeItem, updateItem]);
  return {
    ...list,
    PAGE_TYPES,
    submitting,
    showDialog,
    dialogMode,
    selectedPage,
    formData,
    setFormData,
    setShowDialog,
    openCreateDialog,
    openEditDialog,
    handleTypeChange,
    handleSubmit,
    handleDelete,
    handleTogglePublished
  };
}
