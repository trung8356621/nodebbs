'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationApi } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 通知页面 Hook
 * 管理通知列表、筛选、标记已读、删除等状态和逻辑
 */
export function useNotifications() {
  const pbnT = usePbnTranslations();
  const {
    user
  } = useAuth();

  // ===== 列表状态 =====
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  // ===== 获取通知列表 =====
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const unreadOnly = filter === 'unread';
      const response = await notificationApi.getList(page, pageSize, unreadOnly);
      let items = response.items || [];
      if (filter === 'read') {
        items = items.filter(n => n.isRead);
      }
      setNotifications(items);
      setTotal(response.total || 0);
      setUnreadCount(response.unreadCount || 0);
    } catch (err) {
      console.error("Could not load notifications:", err);
      setError(err.message);
      toast.error(err.message || pbnT("m2150"));
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, filter]);

  // ===== 初始加载和依赖变化时刷新 =====
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // ===== 标记单条为已读 =====
  const markAsRead = useCallback(async id => {
    setActionLoading(`read-${id}`);
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? {
        ...n,
        isRead: true
      } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      toast.success(pbnT("m2151"));
    } catch (err) {
      console.error("Could not mark as read:", err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setActionLoading(null);
    }
  }, []);

  // ===== 全部标记为已读 =====
  const markAllAsRead = useCallback(async () => {
    setActionLoading('read-all');
    try {
      const result = await notificationApi.markAllAsRead();
      toast.success(pbnT("m2153", {
        arg0: result.count
      }));
      await fetchNotifications();
    } catch (err) {
      console.error("Could not mark notifications in bulk:", err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setActionLoading(null);
    }
  }, [fetchNotifications]);

  // ===== 删除单条通知 =====
  const deleteNotification = useCallback(async id => {
    setActionLoading(`delete-${id}`);
    try {
      await notificationApi.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
      toast.success(pbnT("m2155"));
    } catch (err) {
      console.error("Could not delete notification:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setActionLoading(null);
    }
  }, []);

  // ===== 删除所有已读 =====
  const deleteAllRead = useCallback(async () => {
    setActionLoading('delete-all-read');
    try {
      const result = await notificationApi.deleteAllRead();
      toast.success(pbnT("m2157", {
        arg0: result.count
      }));
      await fetchNotifications();
    } catch (err) {
      console.error("Bulk deletion failed:", err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setActionLoading(null);
    }
  }, [fetchNotifications]);

  // ===== 切换筛选 =====
  const handleFilterChange = useCallback(newFilter => {
    setFilter(newFilter);
    setPage(1);
  }, []);

  // ===== 派生状态 =====
  /** 已读数量 */
  const readCount = total - unreadCount;

  /** 检查特定操作是否加载中 */
  const isActionLoading = useCallback(actionId => {
    return actionLoading === actionId;
  }, [actionLoading]);
  return {
    // ===== 列表数据 =====
    /** 通知列表 */
    notifications,
    /** 加载中 */
    loading,
    /** 错误信息 */
    error,
    /** 当前页 */
    page,
    /** 每页数量 */
    pageSize,
    /** 总数 */
    total,
    /** 未读数量 */
    unreadCount,
    /** 已读数量 */
    readCount,
    /** 当前筛选 */
    filter,
    /** 设置页码 */
    setPage,
    // ===== 操作函数 =====
    /** 刷新通知列表 */
    fetchNotifications,
    /** 标记单条为已读 */
    markAsRead,
    /** 全部标记为已读 */
    markAllAsRead,
    /** 删除单条通知 */
    deleteNotification,
    /** 删除所有已读 */
    deleteAllRead,
    /** 切换筛选 */
    handleFilterChange,
    // ===== 加载状态 =====
    /** 检查操作是否加载中 */
    isActionLoading
  };
}
