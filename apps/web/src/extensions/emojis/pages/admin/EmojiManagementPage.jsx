'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FormDialog } from '@/components/common/FormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { Plus, Loader2 } from 'lucide-react';
import { emojiApi } from '@/lib/api'; // import from lib/api
import { toast } from 'sonner';
import { confirm } from '@/components/common/ConfirmPopover';
import EmojiGroupSortable from '../../components/EmojiGroupSortable'; // import from extension components

export default function EmojiGroupsPage() {
  const pbnT = usePbnTranslations();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' | 'edit'

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    isActive: true,
    size: null
  });
  const fetchGroups = useCallback(async () => {
    try {
      const data = await emojiApi.admin.getGroups();
      setGroups(data);
    } catch (err) {
      console.error("Could not load groups:", err);
      toast.error(err.message || pbnT("m1791"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // 创建或编辑分组（本地乐观更新）
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(pbnT("m1792"));
      return;
    }
    if (!formData.slug.trim()) {
      toast.error(pbnT("m1793"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        const res = await emojiApi.admin.createGroup(formData);
        toast.success(pbnT("m1794"));
        setGroups(prev => [...prev, res]);
      } else {
        const res = await emojiApi.admin.updateGroup(selectedGroup.id, formData);
        toast.success(pbnT("m1795"));
        setGroups(prev => prev.map(g => g.id === res.id ? res : g));
      }
      setShowDialog(false);
      resetForm();
    } catch (err) {
      console.error(`Could not ${dialogMode === 'create' ? "Create" : "Update"} group:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setSubmitting(false);
    }
  };

  // 删除分组
  const handleDelete = async (e, group) => {
    const confirmed = await confirm(e, {
      title: pbnT("m1797"),
      description: pbnT("m1798", {
        arg0: group.name
      }),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await emojiApi.admin.deleteGroup(group.id);
      toast.success(pbnT("m1799"));
      setGroups(prev => prev.filter(g => g.id !== group.id));
    } catch (err) {
      console.error("Could not delete group:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };

  // 拖拽排序（乐观更新，失败时回滚）
  const handleReorder = async newOrder => {
    const newGroups = newOrder.map(id => groups.find(g => g.id === id)).filter(Boolean);
    setGroups(newGroups);
    setReordering(true);
    try {
      const items = newOrder.map((id, index) => ({
        id,
        order: index
      }));
      await emojiApi.admin.batchReorderGroups(items);
      toast.success(pbnT("m1781"));
    } catch (err) {
      console.error("Could not save order:", err);
      toast.error(err.message || pbnT("m1782"));
      fetchGroups();
    } finally {
      setReordering(false);
    }
  };
  const openCreateDialog = () => {
    setDialogMode('create');
    resetForm();
    setShowDialog(true);
  };
  const openEditDialog = group => {
    setDialogMode('edit');
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      slug: group.slug,
      isActive: group.isActive !== undefined ? group.isActive : true,
      size: group.size || null
    });
    setShowDialog(true);
  };
  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      isActive: true,
      size: null
    });
    setSelectedGroup(null);
  };
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m1501")} description={pbnT("m1802")} actions={<div className="flex items-center gap-2">
            {reordering && <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" />}
            <Button onClick={openCreateDialog}>
              <Plus className='h-4 w-4' />{pbnT("m1803")}</Button>
          </div>} />

      {loading ? <div className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div> : <EmojiGroupSortable groups={groups} onReorder={handleReorder} onEdit={openEditDialog} onDelete={handleDelete} />}

      <FormDialog open={showDialog} onOpenChange={setShowDialog} title={dialogMode === 'create' ? pbnT("m1803") : pbnT("m1804")} description={dialogMode === 'create' ? pbnT("m1805") : pbnT("m1806")} submitText={dialogMode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleSubmit} loading={submitting}>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>{pbnT("m211")}</Label>
            <Input id='name' value={formData.name} onChange={e => setFormData({
            ...formData,
            name: e.target.value
          })} placeholder={pbnT("m1807")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='slug'>
              Slug *
            </Label>
            <Input id='slug' value={formData.slug} onChange={e => setFormData({
            ...formData,
            slug: e.target.value
          })} placeholder={pbnT("m1808")} maxLength={10} required />
            {dialogMode === 'edit' && formData.slug !== selectedGroup?.slug && <p className='text-sm text-destructive'>{pbnT("m1809")}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='size'>{pbnT("m1810")}{" "}{dialogMode === 'create' ? pbnT("m213") : ''}
            </Label>
            <Input id='size' type="number" min="0" value={formData.size || ''} onChange={e => setFormData({
            ...formData,
            size: e.target.value ? parseInt(e.target.value) : null
          })} placeholder={pbnT("m1811")} />
          </div>

          <div className='flex items-center justify-between space-x-2 rounded-lg border border-border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='isActive' className='text-base'>{pbnT("m1718")}</Label>
              <p className='text-sm text-muted-foreground'>{pbnT("m1812")}</p>
            </div>
            <Switch id='isActive' checked={formData.isActive} onCheckedChange={checked => setFormData({
            ...formData,
            isActive: checked
          })} />
          </div>
        </div>
      </FormDialog>
    </div>;
}
