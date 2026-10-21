'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { Medal, Plus } from 'lucide-react';
import { badgesApi } from '@/extensions/badges/api';
import { toast } from 'sonner';
import { BadgeTable } from '../../components/admin/BadgeTable';
import { BadgeFormDialog } from '../../components/admin/BadgeFormDialog';
import { BadgeAssignmentDialog } from '../../components/admin/BadgeAssignmentDialog';
import { confirm } from '@/components/common/ConfirmPopover';
export default function AdminBadgesPage() {
  const pbnT = usePbnTranslations();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);

  // 派遣/撤销对话框状态
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const fetchData = async () => {
    setLoading(true);
    try {
      const {
        items
      } = await badgesApi.admin.getAll({
        limit: 100
      });
      setItems(items || []);
    } catch (err) {
      console.error('Failed to fetch badges:', err);
      toast.error(err.message || pbnT("m1743"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  const openCreateDialog = () => {
    setSelectedItem(null);
    setDialogMode('create');
    setShowDialog(true);
  };
  const openEditDialog = item => {
    setSelectedItem(item);
    setDialogMode('edit');
    setShowDialog(true);
  };
  const handleSubmit = async data => {
    try {
      if (dialogMode === 'create') {
        await badgesApi.admin.create(data);
        toast.success(pbnT("m1744"));
      } else {
        await badgesApi.admin.update(selectedItem.id, data);
        toast.success(pbnT("m1745"));
      }
      setShowDialog(false);
      fetchData();
    } catch (err) {
      console.error(`Could not ${dialogMode === 'create' ? "Create" : "Update"} badge:`, err);
      toast.error(err.message || pbnT("m568"));
    }
  };

  // 触发确认删除
  const handleDeleteClick = async (e, badge) => {
    const confirmed = await confirm(e, {
      title: pbnT("m1747"),
      description: <>{pbnT("m1748")}<span className="font-bold text-red-500">{pbnT("m1749")}</span>。
          <br />{pbnT("m1750")}<span className="font-bold">{pbnT("m1751")}</span>{pbnT("m1752")}<br />{pbnT("m1753")}<span className="font-bold">{pbnT("m1754")}</span>。
        </>,
      confirmText: pbnT("m246"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await badgesApi.admin.delete(badge.id);
      toast.success(pbnT("m1755"));
      fetchData();
    } catch (err) {
      // 处理特定的 403 错误以优化 UI 显示
      if (err.status === 403 || err.message?.includes(pbnT("m892"))) {
        toast.error(pbnT("m1756"));
      } else {
        console.error("Could not delete badge:", err);
        toast.error(err.message || pbnT("m249"));
      }
    }
  };
  return <div className="space-y-6">
      <PageHeader title={pbnT("m1506")} description={pbnT("m1758")} actions={<div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAssignmentDialog(true)}>{pbnT("m1759")}</Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />{pbnT("m1677")}</Button>
          </div>} />

      <BadgeTable items={items} loading={loading} onEdit={openEditDialog} onDelete={handleDeleteClick} // 现在传递项目对象或 ID，由包装器处理
    />

      <BadgeFormDialog open={showDialog} onOpenChange={setShowDialog} mode={dialogMode} initialData={selectedItem} onSubmit={handleSubmit} />
      
      <BadgeAssignmentDialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog} badgeList={items} />
      

    </div>;
}
