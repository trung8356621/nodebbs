'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { Plus, Edit, Trash2, Lock } from 'lucide-react';
import FeaturedCategorySortable from './components/FeaturedCategorySortable';
import { CategoryFormDialog } from './components/CategoryFormDialog';
import { useCategoryManagement } from '@/modules/forum/hooks/dashboard/useCategoryManagement';
export default function CategoriesManagement() {
  const pbnT = usePbnTranslations();
  const {
    flatCategories,
    featuredCategories,
    loading,
    activeTab,
    setActiveTab,
    showDialog,
    setShowDialog,
    dialogMode,
    selectedCategory,
    submitting,
    formData,
    setFormData,
    reordering,
    openCreateDialog,
    openEditDialog,
    handleSubmit,
    handleDeleteClick,
    handleReorder
  } = useCategoryManagement();
  const columns = [{
    key: 'name',
    label: pbnT("m230"),
    render: (_, category) => {
      const parentCategory = category.parentId ? flatCategories.find(c => c.id === category.parentId) : null;
      return <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              {category.level > 0 && <span className='text-muted-foreground text-xs' style={{
            marginLeft: `${(category.level - 1) * 20}px`
          }}>
                  └─
                </span>}
              <span className='font-medium text-sm'>{category.name}</span>
              {category.isFeatured && <span className='px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded'>{pbnT("m231")}</span>}
              {category.isPrivate && <Lock className='h-3.5 w-3.5 text-muted-foreground' title={pbnT("m223")} />}
            </div>
            {parentCategory && <div className='text-xs text-muted-foreground' style={{
          marginLeft: `${category.level * 20 + 20}px`
        }}>{pbnT("m232")}{" "}{parentCategory.name}
              </div>}
          </div>;
    }
  }, {
    key: 'slug',
    label: 'Slug',
    width: 'w-50',
    render: value => <code className='text-xs text-muted-foreground bg-muted px-2 py-1 rounded'>
          {value}
        </code>
  }, {
    key: 'color',
    label: pbnT("m220"),
    width: 'w-[150px]',
    render: value => <div className='flex items-center gap-2'>
          <div className='w-5 h-5 rounded border border-border' style={{
        backgroundColor: value
      }} />
          <span className='text-xs text-muted-foreground font-mono'>{value}</span>
        </div>
  }, {
    key: 'topicCount',
    label: pbnT("m233"),
    width: 'w-25',
    render: value => <span className='text-sm'>{value || 0}</span>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, category) => <ActionMenu mode='inline' items={[{
      label: pbnT("m235"),
      icon: Edit,
      onClick: () => openEditDialog(category)
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      variant: 'destructive',
      onClick: e => handleDeleteClick(e, category)
    }]} />
  }];
  return <div className='space-y-6'>
      <PageHeader title={pbnT("m236")} description={pbnT("m237")} actions={<Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4' />{pbnT("m205")}</Button>} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='all'>{pbnT("m238")}</TabsTrigger>
          <TabsTrigger value='featured' className='gap-2'>{pbnT("m221")}{featuredCategories.length > 0 && <Badge variant='secondary'>{featuredCategories.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='all' className='mt-4'>
          <DataTable columns={columns} data={flatCategories} loading={loading} emptyMessage={pbnT("m239")} />
        </TabsContent>

        <TabsContent value='featured' className='mt-4'>
          <FeaturedCategorySortable categories={featuredCategories} onReorder={handleReorder} loading={reordering} />
        </TabsContent>
      </Tabs>

      <CategoryFormDialog open={showDialog} onOpenChange={setShowDialog} mode={dialogMode} selectedCategory={selectedCategory} formData={formData} setFormData={setFormData} onSubmit={handleSubmit} submitting={submitting} />
    </div>;
}
