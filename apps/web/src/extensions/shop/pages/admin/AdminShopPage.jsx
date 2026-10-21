'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { confirm } from '@/components/common/ConfirmPopover';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ShoppingCart, Plus } from 'lucide-react';
import { shopApi } from '@/lib/api';
import { toast } from 'sonner';
import { useShopItems } from '../../hooks/useShopItems';
import { ShopItemTable } from '../../components/admin/ShopItemTable';
import { ShopItemFormDialog } from '../../components/admin/ShopItemFormDialog';
import { useDefaultCurrencyName } from '@/extensions/ledger/contexts/LedgerContext';
export default function AdminShopPage() {
  const pbnT = usePbnTranslations();
  const currencyName = useDefaultCurrencyName();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const {
    items,
    total,
    loading,
    refetch
  } = useShopItems({
    page,
    limit,
    isAdmin: true
  });
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
  const handleSubmit = async formData => {
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        price: parseInt(formData.price),
        stock: formData.stock === null || formData.stock === '' ? null : parseInt(formData.stock),
        displayOrder: parseInt(formData.displayOrder)
      };
      if (dialogMode === 'create') {
        await shopApi.admin.createItem(submitData);
        toast.success(pbnT("m2036"));
      } else {
        await shopApi.admin.updateItem(selectedItem.id, submitData);
        toast.success(pbnT("m2037"));
      }
      setShowDialog(false);
      refetch();
    } catch (err) {
      console.error(`Could not ${dialogMode === 'create' ? "Create" : "Update"} item:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDeleteClick = async (e, item) => {
    const confirmed = await confirm(e, {
      title: pbnT("m246"),
      description: <>{pbnT("m2039")}{item.name}{pbnT("m244")}<br />
          <span className="text-destructive font-medium">{pbnT("m2040")}</span>
        </>,
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await shopApi.admin.deleteItem(item.id);
      toast.success(pbnT("m2041"));
      refetch();
    } catch (err) {
      console.error("Could not delete item:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };
  return <div className="space-y-6">
      <PageHeader title={pbnT("m1505")} description={pbnT("m2043", {
      arg0: currencyName
    })} actions={<Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />{pbnT("m1940")}</Button>} />

      {/* Shop Items Table */}
      <ShopItemTable items={items} loading={loading} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} onEdit={openEditDialog} onDelete={handleDeleteClick} />

      {/* Create/Edit Dialog */}
      <ShopItemFormDialog open={showDialog} onOpenChange={setShowDialog} mode={dialogMode} initialData={selectedItem} onSubmit={handleSubmit} submitting={submitting} />
    </div>;
}
