'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { useAdminList } from './useAdminList';
import { userApi, moderationApi, rbacApi } from '@/lib/api';
import { confirm } from '@/components/common/ConfirmPopover';
import { toast } from 'sonner';

/**
 * 用户管理 Hook
 * 组合 useAdminList，添加用户 CRUD 和管理操作
 */
export function useUserManagement() {
  const pbnT = usePbnTranslations();
  const list = useAdminList({
    fetchFn: async params => {
      const apiParams = {
        page: params.page,
        limit: params.limit
      };
      if (params.search) apiParams.search = params.search;
      const sf = params.statusFilter;
      if (sf === 'banned') apiParams.isBanned = true;
      if (sf === 'deleted') {
        apiParams.isDeleted = true;
      }
      if (sf === 'pending_deletion') {
        apiParams.pendingDeletion = true;
      }
      if (sf === 'unverified_email') {
        apiParams.isEmailVerified = false;
      }
      delete apiParams.statusFilter;
      return userApi.getList(apiParams);
    },
    pageSize: 20,
    defaultFilters: {
      statusFilter: 'all'
    }
  });
  const {
    updateItem,
    removeItem,
    refreshList,
    filters
  } = list;

  // ===== 角色数据 =====
  const [availableRoles, setAvailableRoles] = useState([]);
  useEffect(() => {
    rbacApi.admin.getRoles().then(setAvailableRoles).catch(err => console.error("Could not load roles:", err));
  }, []);

  // ===== 对话框状态 =====
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ===== 对话框操作 =====
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    setSelectedUser(null);
    setShowUserDialog(true);
  }, []);
  const openEditDialog = useCallback(user => {
    setDialogMode('edit');
    setSelectedUser(user);
    setShowUserDialog(true);
  }, []);
  const openRoleDialog = useCallback(user => {
    setSelectedUser(user);
    setShowRoleDialog(true);
  }, []);
  const openBanDialog = useCallback(user => {
    setSelectedUser(user);
    setShowBanDialog(true);
  }, []);
  const shouldRemoveBannedUserFromList = useCallback(() => {
    return filters.statusFilter === 'active';
  }, [filters.statusFilter]);
  const shouldRemoveDeletedUserFromList = useCallback(() => {
    return filters.statusFilter !== 'deleted' && filters.statusFilter !== 'pending_deletion';
  }, [filters.statusFilter]);

  // ===== 行内操作 =====
  const handleUnbanClick = useCallback(async (e, user) => {
    const confirmed = await confirm(e, {
      title: pbnT("m2093"),
      description: <>{pbnT("m2094")}{user.username}{pbnT("m244")}<br />{pbnT("m2095")}</>,
      confirmText: pbnT("m2096")
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await moderationApi.unbanUser(user.id);
      toast.success(pbnT("m2097", {
        arg0: user.username
      }));
      // 如果当前筛选为已封禁，则从列表中移除；否则更新状态
      if (filters.statusFilter === 'banned') {
        removeItem(user.id);
      } else {
        updateItem(user.id, {
          isBanned: false
        });
      }
    } catch (err) {
      console.error("Could not unban:", err);
      toast.error(err.message || pbnT("m2099"));
    } finally {
      setSubmitting(false);
    }
  }, [updateItem, removeItem, filters]);
  const handleDeleteClick = useCallback(async (e, user, type) => {
    const isHard = type === 'hard';
    const confirmed = await confirm(e, {
      title: isHard ? pbnT("m2100") : pbnT("m2101"),
      description: isHard ? <>{pbnT("m2102")}<span className='font-semibold text-destructive'>{pbnT("m438")}</span>{pbnT("m2103")}{user.username}{pbnT("m2104")}<br />
            <span className='font-semibold text-destructive'>{pbnT("m245")}</span>
          </> : <>{pbnT("m2105")}{user.username}&quot;。
            <br />{pbnT("m2106")}</>,
      confirmText: pbnT("m246"),
      variant: isHard ? 'destructive' : 'default'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await userApi.deleteUser(user.id, isHard);
      toast.success(isHard ? pbnT("m2107", {
        arg0: user.username
      }) : pbnT("m2108", {
        arg0: user.username
      }));
      if (isHard) {
        removeItem(user.id);
      } else if (shouldRemoveDeletedUserFromList()) {
        removeItem(user.id);
      } else {
        updateItem(user.id, {
          isDeleted: true
        });
      }
    } catch (err) {
      console.error("Could not delete:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setSubmitting(false);
    }
  }, [updateItem, removeItem, shouldRemoveDeletedUserFromList]);
  const handleRestoreClick = useCallback(async (e, user) => {
    const confirmed = await confirm(e, {
      title: pbnT("m2109"),
      description: <>{pbnT("m2110")}{user.username}{pbnT("m2111")}<br />{pbnT("m2112")}</>,
      confirmText: pbnT("m285")
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await userApi.restoreUser(user.id);
      toast.success(pbnT("m2113", {
        arg0: user.username
      }));
      updateItem(user.id, {
        isDeleted: false,
        deletionRequestedAt: null
      });
      // 如果当前筛选为已删除/待注销，则从列表中移除
      if (filters.statusFilter === 'deleted' || filters.statusFilter === 'pending_deletion') {
        removeItem(user.id);
      }
    } catch (err) {
      console.error("Could not restore:", err);
      toast.error(err.message || pbnT("m288"));
    } finally {
      setSubmitting(false);
    }
  }, [updateItem, removeItem, filters]);
  const handleAnonymizeClick = useCallback(async (e, user) => {
    const confirmed = await confirm(e, {
      title: pbnT("m2114"),
      description: <>{pbnT("m2102")}<span className='font-semibold text-destructive'>{pbnT("m2115")}</span>{pbnT("m2103")}{user.username}{pbnT("m2116")}<br />
            <span className='font-semibold text-destructive'>{pbnT("m245")}</span>
          </>,
      confirmText: pbnT("m2117"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await userApi.anonymizeUser(user.id);
      toast.success(pbnT("m2118", {
        arg0: user.username
      }));
      refreshList();
    } catch (err) {
      console.error("Could not anonymize:", err);
      toast.error(err.message || pbnT("m2120"));
    } finally {
      setSubmitting(false);
    }
  }, [refreshList]);

  // ===== 回调 =====
  const handleUserCreated = useCallback(() => refreshList(), [refreshList]);
  const handleUserUpdated = useCallback((userId, updateData, updatedRoles) => {
    updateItem(userId, {
      ...updateData,
      userRoles: updatedRoles
    });
  }, [updateItem]);
  const handleRolesUpdated = useCallback((userId, updatedRoles) => {
    updateItem(userId, {
      userRoles: updatedRoles
    });
  }, [updateItem]);
  const handleBanned = useCallback(userId => {
    if (shouldRemoveBannedUserFromList()) {
      removeItem(userId);
      return;
    }
    updateItem(userId, {
      isBanned: true
    });
  }, [updateItem, removeItem, shouldRemoveBannedUserFromList]);
  const canModifyUser = useCallback(user => !!user.canManage, []);
  return {
    ...list,
    // 角色
    availableRoles,
    // 对话框状态
    selectedUser,
    showUserDialog,
    setShowUserDialog,
    dialogMode,
    showRoleDialog,
    setShowRoleDialog,
    showBanDialog,
    setShowBanDialog,
    submitting,
    // 对话框操作
    openCreateDialog,
    openEditDialog,
    openRoleDialog,
    openBanDialog,
    // 行内操作
    handleUnbanClick,
    handleDeleteClick,
    handleRestoreClick,
    handleAnonymizeClick,
    // 回调
    handleUserCreated,
    handleUserUpdated,
    handleRolesUpdated,
    handleBanned,
    canModifyUser
  };
}
