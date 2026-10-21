'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { Eye, Trash2 } from 'lucide-react';
import Link from '@/components/common/Link';
import Time from '@/components/common/Time';
import { usePermission } from '@/hooks/usePermission';
import { usePostManagement } from '@/modules/forum/hooks/dashboard/usePostManagement';
export default function AdminPostsPage() {
  const pbnT = usePbnTranslations();
  const {
    hasPermission,
    hasCondition
  } = usePermission();
  const {
    items: posts,
    loading,
    search,
    setSearch,
    filters,
    setFilter,
    page,
    total,
    limit,
    setPage,
    handleDeleteClick
  } = usePostManagement();
  const columns = [{
    key: 'id',
    label: 'ID',
    width: 'w-15',
    render: value => <span className='font-mono text-xs'>#{value}</span>
  }, {
    key: 'content',
    label: pbnT("m353"),
    render: (value, row) => <div className='flex flex-col gap-1 max-w-xl'>
          <div className='font-medium line-clamp-2 text-ellipsis whitespace-normal'>{value}</div>
          <div className='space-x-2 text-muted-foreground line-clamp-1 text-ellipsis'>
            <span>{pbnT("m432")}</span>
            <Link href={`/topic/${row.topicId}#post-${row.id}`} className='hover:text-primary hover:underline' target='_blank'>
              {row.topicTitle}
            </Link>
          </div>
        </div>
  }, {
    key: 'username',
    label: pbnT("m433"),
    width: 'w-30',
    render: (value, row) => <div className='flex flex-col gap-1'>
          <Link href={`/users/${value}`} className='text-sm hover:text-primary hover:underline' target='_blank'>
            {value}
          </Link>
          <Badge variant='outline' className='text-xs w-fit'>
            {row.userRole}
          </Badge>
        </div>
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
      return <Badge variant='default' className='text-xs'>{pbnT("m436")}</Badge>;
    }
  }, {
    key: 'likeCount',
    label: pbnT("m128"),
    width: 'w-20',
    align: 'center',
    render: value => <span className='text-sm text-muted-foreground'>{value}</span>
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
      label: pbnT("m437"),
      icon: Eye,
      href: `/topic/${row.topicId}#post-${row.id}`,
      target: '_blank'
    }, {
      separator: true,
      hidden: !hasPermission('post.delete')
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      variant: 'warning',
      onClick: e => handleDeleteClick(e, row, 'soft'),
      hidden: row.isDeleted || !hasPermission('post.delete')
    }, {
      label: pbnT("m438"),
      icon: Trash2,
      variant: 'destructive',
      onClick: e => handleDeleteClick(e, row, 'hard'),
      hidden: !hasCondition('dashboard.posts', 'allowPermanent')
    }]} />
  }];
  return <div>
      <PageHeader title={pbnT("m439")} description={pbnT("m440")} />

      <DataTable columns={columns} data={posts} loading={loading} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m441")
    }} filter={{
      value: filters.statusFilter,
      onChange: value => setFilter('statusFilter', value),
      options: [{
        value: 'all',
        label: pbnT("m442")
      }, {
        value: 'pending',
        label: pbnT("m379")
      }, {
        value: 'approved',
        label: pbnT("m436")
      }, {
        value: 'rejected',
        label: pbnT("m434")
      }, {
        value: 'deleted',
        label: pbnT("m435")
      }]
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} emptyMessage={pbnT("m125")} />
    </div>;
}
