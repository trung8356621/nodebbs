'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Time from '@/components/common/Time';
import { Check, Edit, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { usePageManagement } from '@/hooks/dashboard/usePageManagement';
function getTypeBadgeClassName(type) {
  if (type === 'text') return 'bg-slate-100 text-slate-800';
  if (type === 'html') return 'bg-emerald-100 text-emerald-800';
  if (type === 'markdown') return 'bg-blue-100 text-blue-800';
  if (type === 'json') return 'bg-amber-100 text-amber-800';
  return '';
}
function getContentPlaceholder(type, pbnT = pbnRuntimeT) {
  if (type === 'json') {
    return '{\n  "key": "value"\n}';
  }
  if (type === 'html') {
    return pbnT("m397");
  }
  if (type === 'markdown') {
    return pbnT("m398");
  }
  return pbnT("m399");
}
function getTypeDescription(type, pbnT = pbnRuntimeT) {
  if (type === 'text') {
    return pbnT("m400");
  }
  if (type === 'html') {
    return pbnT("m401");
  }
  if (type === 'markdown') {
    return pbnT("m402");
  }
  if (type === 'json') {
    return pbnT("m403");
  }
  return '';
}
function normalizeSlugPreview(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/').toLowerCase();
}
export default function PagesManagementPage() {
  const pbnT = usePbnTranslations();
  const {
    items: pages,
    loading,
    search,
    setSearch,
    filters,
    setFilter,
    page,
    total,
    limit,
    submitting,
    showDialog,
    dialogMode,
    formData,
    setFormData,
    PAGE_TYPES,
    setShowDialog,
    openCreateDialog,
    openEditDialog,
    handleTypeChange,
    handleSubmit,
    handleDelete,
    handleTogglePublished,
    setPage
  } = usePageManagement();
  const normalizedSlug = normalizeSlugPreview(formData.slug);
  const routePreview = normalizedSlug ? `/${normalizedSlug}` : '/your-page';
  const typeDescription = getTypeDescription(formData.type, pbnT);
  const columns = [{
    key: 'title',
    label: pbnT("m404"),
    render: (_, pageItem) => <div className='space-y-1'>
          <div className='font-medium text-sm'>{pageItem.title}</div>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <code className='bg-muted px-2 py-0.5 rounded'>{pageItem.slug}</code>
            <a href={`/${pageItem.slug}`} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1 hover:text-foreground'>{pbnT("m405")}<ExternalLink className='h-3 w-3' />
            </a>
          </div>
        </div>
  }, {
    key: 'type',
    label: pbnT("m406"),
    width: 'w-30',
    render: (value, pageItem) => <div className='flex items-center gap-1.5'>
          <Badge variant='secondary' className={getTypeBadgeClassName(value)}>
            {value}
          </Badge>
          {pageItem.standalone && <Badge variant='outline' className='text-xs'>{pbnT("m407")}</Badge>}
        </div>
  }, {
    key: 'isPublished',
    label: pbnT("m298"),
    width: 'w-30',
    render: value => <Badge variant={value ? 'default' : 'secondary'}>
          {value ? pbnT("m408") : pbnT("m409")}
        </Badge>
  }, {
    key: 'updatedAt',
    label: pbnT("m410"),
    width: 'w-45',
    render: value => <Time date={value} format='YYYY-MM-DD HH:mm' className='text-sm text-muted-foreground' />
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, pageItem) => <ActionMenu items={[{
      label: pbnT("m235"),
      icon: Edit,
      onClick: () => openEditDialog(pageItem)
    }, {
      label: pageItem.isPublished ? pbnT("m411") : pbnT("m412"),
      icon: pageItem.isPublished ? X : Check,
      onClick: () => handleTogglePublished(pageItem, !pageItem.isPublished),
      disabled: Boolean(pageItem._statusUpdating)
    }, {
      separator: true
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      variant: 'destructive',
      onClick: e => handleDelete(e, pageItem)
    }]} />
  }];
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m413")} description={pbnT("m414")} actions={<Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4' />{pbnT("m415")}</Button>} />

      <DataTable columns={columns} data={pages} loading={loading} emptyMessage={pbnT("m416")} search={{
      value: search,
      onChange: setSearch,
      placeholder: pbnT("m417")
    }} filters={[{
      value: filters.typeFilter,
      onChange: value => setFilter('typeFilter', value),
      options: [{
        value: 'all',
        label: pbnT("m418")
      }, ...PAGE_TYPES.map(type => ({
        value: type,
        label: type
      }))]
    }, {
      value: filters.statusFilter,
      onChange: value => setFilter('statusFilter', value),
      options: [{
        value: 'all',
        label: pbnT("m419")
      }, {
        value: 'published',
        label: pbnT("m408")
      }, {
        value: 'draft',
        label: pbnT("m409")
      }]
    }]} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} />

      <FormDialog open={showDialog} onOpenChange={setShowDialog} title={dialogMode === 'create' ? pbnT("m415") : pbnT("m420")} description={pbnT("m421")} onSubmit={handleSubmit} loading={submitting} submitText={dialogMode === 'create' ? pbnT("m209") : pbnT("m210")} maxWidth='sm:max-w-4xl'>
        <div className='space-y-5 pb-2'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='title'>{pbnT("m422")}</Label>
              <Input id='title' value={formData.title} onChange={e => setFormData(prev => ({
              ...prev,
              title: e.target.value
            }))} placeholder={pbnT("m423")} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='slug'>{pbnT("m424")}</Label>
              <Input id='slug' value={formData.slug} onChange={e => setFormData(prev => ({
              ...prev,
              slug: e.target.value
            }))} placeholder={pbnT("m425")} />
              <p className='text-xs text-muted-foreground'>{pbnT("m426")}</p>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label>{pbnT("m427")}</Label>
              <Select value={formData.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map(type => <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>{pbnT("m428")}</Label>
              <div className='rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5'>
                <div className='font-mono text-sm'>{routePreview}</div>
                <p className='text-xs text-muted-foreground'>
                  {typeDescription}
                </p>
              </div>
            </div>
          </div>

          {(formData.type === 'html' || formData.type === 'markdown') && <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
              <div className='space-y-0.5'>
                <Label htmlFor='standalone'>{pbnT("m429")}</Label>
                <p className='text-xs text-muted-foreground'>{pbnT("m430")}</p>
              </div>
              <Switch id='standalone' checked={formData.standalone} onCheckedChange={checked => setFormData(prev => ({
            ...prev,
            standalone: checked
          }))} />
            </div>}

          <div className='space-y-2'>
            <Label htmlFor='content'>{pbnT("m431")}</Label>
            <Textarea id='content' value={formData.content} onChange={e => setFormData(prev => ({
            ...prev,
            content: e.target.value
          }))} placeholder={getContentPlaceholder(formData.type, pbnT)} className='min-h-[360px] font-mono text-sm' />
          </div>
        </div>
      </FormDialog>
    </div>;
}
