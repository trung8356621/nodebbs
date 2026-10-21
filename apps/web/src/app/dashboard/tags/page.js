'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { Plus, Edit, Trash2, Tag as TagIcon } from 'lucide-react';
import { useTagManagement } from '@/modules/forum/hooks/dashboard/useTagManagement';
import { TagFormDialog } from './components/TagFormDialog';
export default function TagsManagement() {
  const pbnT = usePbnTranslations();
  const {
    items: tags,
    loading,
    search,
    setSearch,
    page,
    total,
    limit,
    setPage,
    showDialog,
    setShowDialog,
    isEdit,
    submitting,
    formData,
    setFormData,
    openCreateDialog,
    openEditDialog,
    handleSubmit,
    handleDeleteClick
  } = useTagManagement();
  const columns = [{
    key: 'name',
    label: pbnT("m824"),
    width: 'w-50',
    render: (_, tag) => <Badge className='text-xs'>
          <TagIcon className='h-3 w-3 mr-1' />
          {tag.name}
        </Badge>
  }, {
    key: 'slug',
    label: 'Slug',
    width: 'w-50',
    render: value => <code className='text-xs text-muted-foreground bg-muted px-2 py-1 rounded'>
          {value}
        </code>
  }, {
    key: 'description',
    label: pbnT("m218"),
    render: value => <span className='text-sm text-muted-foreground'>{value || '-'}</span>
  }, {
    key: 'topicCount',
    label: pbnT("m825"),
    width: 'w-25',
    render: value => <span className='text-sm'>{value || 0}</span>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, tag) => <ActionMenu mode='inline' items={[{
      label: pbnT("m235"),
      icon: Edit,
      onClick: () => openEditDialog(tag)
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      onClick: e => handleDeleteClick(e, tag),
      variant: 'destructive'
    }]} />
  }];
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m826")} description={pbnT("m827")} actions={<Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4' />{pbnT("m818")}</Button>} />

      <DataTable columns={columns} data={tags} loading={loading} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m828")
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} emptyMessage={pbnT("m829")} />

      <TagFormDialog open={showDialog} onOpenChange={setShowDialog} isEdit={isEdit} formData={formData} setFormData={setFormData} onSubmit={handleSubmit} submitting={submitting} />
    </div>;
}
