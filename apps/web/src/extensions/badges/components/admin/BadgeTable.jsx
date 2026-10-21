import { usePbnTranslations } from "@/i18n/useTranslations";
import React from 'react';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
export function BadgeTable({
  items,
  loading,
  onEdit,
  onDelete
}) {
  const pbnT = usePbnTranslations();
  const columns = [{
    key: 'iconUrl',
    label: pbnT("m1690"),
    render: (value, item) => <img src={value} alt={item.name} className="w-24 h-24 object-contain" />
  }, {
    key: 'name',
    label: pbnT("m230"),
    render: value => <span className="font-medium">{value}</span>
  }, {
    key: 'slug',
    label: 'Slug',
    render: value => <span className="text-gray-500 text-sm">{value}</span>
  }, {
    key: 'category',
    label: pbnT("m44"),
    render: value => <Badge variant="outline">{value || 'default'}</Badge>
  }, {
    key: 'unlockCondition',
    label: pbnT("m1720"),
    render: value => <div className="max-w-50 truncate">{value || '-'}</div>
  }, {
    key: 'isActive',
    label: pbnT("m298"),
    render: value => <Badge variant={value ? 'default' : 'secondary'}>
          {value ? pbnT("m1609") : pbnT("m304")}
        </Badge>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, item) => <ActionMenu mode="inline" items={[{
      label: pbnT("m235"),
      icon: Edit,
      onClick: () => onEdit(item)
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      onClick: e => onDelete(e, item),
      variant: 'destructive'
    }]} />
  }];
  return <DataTable columns={columns} data={items} loading={loading} emptyMessage={pbnT("m1721")} pagination={{
    total: items.length,
    limit: items.length,
    // Currently showing all
    page: 1,
    onPageChange: () => {}
  }} />;
}
