import { usePbnTranslations } from "@/i18n/useTranslations";
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { ItemTypeIcon } from '../shared/ItemTypeIcon';
import { getItemTypeLabel } from '../../utils/itemTypes';
import { useLedger } from '../../../ledger/contexts/LedgerContext';

/**
 * 管理后台商品列表表格
 * @param {Object} props
 * @param {Array} props.items - 商品数组
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.pagination - { page, total, limit, onPageChange }
 * @param {Function} props.onEdit - 点击编辑时的回调
 * @param {Function} props.onDelete - 确认删除时的回调
 */
export function ShopItemTable({
  items,
  loading,
  pagination,
  onEdit,
  onDelete
}) {
  const pbnT = usePbnTranslations();
  const {
    currencies
  } = useLedger();
  const getCurrencyName = code => {
    const c = currencies.find(c => c.code === code);
    return c?.name || code;
  };
  const columns = [{
    label: 'ID',
    key: 'id',
    render: value => <span className="text-muted-foreground">#{value}</span>
  }, {
    label: pbnT("m406"),
    key: 'type',
    render: value => <div className="flex items-center gap-2">
          <ItemTypeIcon type={value} className="h-4 w-4" />
          <span>{getItemTypeLabel(value, pbnT)}</span>
        </div>
  }, {
    label: pbnT("m1973"),
    key: 'name',
    render: (value, row) => <div className="flex items-center gap-3">
          {row.imageUrl && <div className="relative w-24 h-24">
              <img src={row.imageUrl} alt={row.name} className="object-contain w-full h-full" />
            </div>}
          <div>
            <div className="font-medium">{row.name}</div>
            {row.description && <div className="text-sm text-muted-foreground line-clamp-1">
                {row.description}
              </div>}
          </div>
        </div>
  }, {
    label: pbnT("m1958"),
    key: 'price',
    render: value => <span className="font-semibold text-yellow-600">{value}</span>
  }, {
    label: pbnT("m1827"),
    key: 'currencyCode',
    render: value => <span className="text-muted-foreground">{getCurrencyName(value)}</span>
  }, {
    label: pbnT("m1959"),
    key: 'stock',
    render: value => <span>
          {value === null ? <Badge variant="secondary">{pbnT("m1960")}</Badge> : <Badge variant={value > 10 ? 'default' : 'destructive'}>
              {value}
            </Badge>}
        </span>
  }, {
    label: pbnT("m298"),
    key: 'isActive',
    render: value => <Badge variant={value ? 'default' : 'secondary'}>
          {value ? pbnT("m1974") : pbnT("m1975")}
        </Badge>
  }, {
    label: pbnT("m1976"),
    key: 'displayOrder',
    render: value => <span className="text-muted-foreground">{value || 0}</span>
  }, {
    label: pbnT("m234"),
    key: 'operation',
    align: 'right',
    sticky: 'right',
    render: (value, row) => <ActionMenu mode="inline" items={[{
      label: pbnT("m235"),
      icon: Edit,
      onClick: () => onEdit(row)
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      onClick: e => onDelete(e, row),
      variant: 'destructive'
    }]} />
  }];
  return <DataTable columns={columns} data={items} loading={loading} pagination={pagination} />;
}
