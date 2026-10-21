'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { Trash2, Eye, Lock, Unlock, Pin, PinOff, Clock, AlertCircle } from 'lucide-react';
import Link from '@/components/common/Link';
import Time from '@/components/common/Time';
import { usePermission } from '@/hooks/usePermission';
import { useTopicManagement } from '@/modules/forum/hooks/dashboard/useTopicManagement';
export default function AdminTopicsPage() {
  const pbnT = usePbnTranslations();
  const {
    hasPermission,
    hasCondition
  } = usePermission();
  const {
    items: topics,
    loading,
    search,
    setSearch,
    filters,
    setFilter,
    page,
    total,
    limit,
    setPage,
    selectedIds,
    setSelectedIds,
    batchDeleting,
    handleTogglePin,
    handleToggleClosed,
    handleDeleteClick,
    handleBatchDelete
  } = useTopicManagement();
  const columns = [{
    key: 'id',
    label: 'ID',
    width: 'w-15',
    render: value => <span className='font-mono text-xs'>#{value}</span>
  }, {
    key: 'title',
    label: pbnT("m830"),
    render: (value, row) => <div className='flex items-center gap-2 max-w-xl [&>*:not(:first-child)]:shrink-0'>
          <Link href={`/topic/${row.id}`} className='hover:text-primary hover:underline font-medium line-clamp-2 whitespace-normal text-ellipsis' target='_blank'>
            {value}
          </Link>
          {row.isPinned && <Pin className='h-3 w-3 text-orange-500' />}
          {row.isClosed && <Lock className='h-3 w-3 text-muted-foreground' />}
          {row.approvalStatus === 'pending' && <Clock className='h-3 w-3 text-chart-5' />}
          {row.approvalStatus === 'rejected' && <AlertCircle className='h-3 w-3 text-destructive' />}
        </div>
  }, {
    key: 'categoryName',
    label: pbnT("m44"),
    width: 'w-30',
    render: value => <Badge variant='secondary' className='text-xs'>
          {value}
        </Badge>
  }, {
    key: 'username',
    label: pbnT("m433"),
    width: 'w-30',
    render: value => <Link href={`/users/${value}`} className='text-sm hover:text-primary hover:underline' target='_blank'>
          {value}
        </Link>
  }, {
    key: 'status',
    label: pbnT("m298"),
    width: 'w-25',
    render: (_, row) => {
      if (row.approvalStatus === 'pending') {
        return <Badge variant='outline' className='text-chart-5 border-chart-5 text-xs'>{pbnT("m379")}</Badge>;
      }
      if (row.approvalStatus === 'rejected') {
        return <Badge variant='outline' className='text-destructive border-destructive text-xs'>{pbnT("m434")}</Badge>;
      }
      if (row.isDeleted) {
        return <Badge variant='destructive' className='text-xs'>{pbnT("m435")}</Badge>;
      }
      if (row.isClosed) {
        return <Badge variant='secondary' className='text-xs'>{pbnT("m831")}</Badge>;
      }
      return <Badge variant='default' className='text-xs'>{pbnT("m832")}</Badge>;
    }
  }, {
    key: 'createdAt',
    label: pbnT("m303"),
    width: 'w-30',
    render: value => <span className='text-xs text-muted-foreground'>
          <Time date={value} />
        </span>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, row) => <ActionMenu items={[{
      label: pbnT("m833"),
      icon: Eye,
      href: `/topic/${row.id}`,
      target: '_blank'
    }, {
      separator: true
    }, {
      label: row.isPinned ? pbnT("m106") : pbnT("m107"),
      icon: row.isPinned ? PinOff : Pin,
      onClick: () => handleTogglePin(row.id, row.isPinned),
      hidden: !hasPermission('dashboard.topics')
    }, {
      label: row.isClosed ? pbnT("m92") : pbnT("m93"),
      icon: row.isClosed ? Unlock : Lock,
      onClick: () => handleToggleClosed(row.id, row.isClosed),
      hidden: !hasPermission('dashboard.topics')
    }, {
      separator: true,
      hidden: !hasPermission('dashboard.topics')
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      variant: 'warning',
      onClick: e => handleDeleteClick(e, row, 'soft'),
      hidden: row.isDeleted || !hasPermission('dashboard.topics')
    }, {
      label: pbnT("m438"),
      icon: Trash2,
      variant: 'destructive',
      onClick: e => handleDeleteClick(e, row, 'hard'),
      hidden: !hasCondition('dashboard.topics', 'allowPermanent')
    }]} />
  }];
  return <div>
      <PageHeader title={pbnT("m834")} description={pbnT("m835")} />

      <DataTable columns={columns} data={topics} loading={loading} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m836")
    }} filter={{
      value: filters.statusFilter,
      onChange: value => setFilter('statusFilter', value),
      options: [{
        value: 'all',
        label: pbnT("m56")
      }, {
        value: 'pending',
        label: pbnT("m379")
      }, {
        value: 'rejected',
        label: pbnT("m434")
      }, {
        value: 'pinned',
        label: pbnT("m107")
      }, {
        value: 'closed',
        label: pbnT("m831")
      }, {
        value: 'deleted',
        label: pbnT("m435")
      }]
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} emptyMessage={pbnT("m837")} selection={hasPermission('dashboard.topics') ? {
      selectedIds,
      onSelectionChange: setSelectedIds
    } : undefined} batchActions={[{
      label: pbnT("m838"),
      icon: Trash2,
      variant: 'destructive',
      onClick: handleBatchDelete,
      loading: batchDeleting
    }]} />
    </div>;
}
