'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { Eye, CheckSquare, XSquare } from 'lucide-react';
import Link from '@/components/common/Link';
import Time from '@/components/common/Time';
import { useReportManagement } from '@/hooks/dashboard/useReportManagement';
import { ReportResolveDialog } from './components/ReportResolveDialog';
import { ReportDetailDialog } from './components/ReportDetailDialog';
import { ReportTypeBadge, ReportStatusBadge, getReportTargetLink } from './components/ReportBadges';
export default function ReportsManagement() {
  const pbnT = usePbnTranslations();
  const {
    items: reports,
    loading,
    search,
    setSearch,
    filters,
    setFilter,
    page,
    total,
    limit,
    setPage,
    // 处理对话框
    resolveDialogOpen,
    setResolveDialogOpen,
    selectedReport,
    resolveAction,
    resolving,
    handleResolve,
    openResolveDialog,
    // 详情对话框
    detailDialogOpen,
    setDetailDialogOpen,
    detailReport,
    openDetailDialog
  } = useReportManagement();
  const columns = [{
    key: 'id',
    label: 'ID',
    width: 'w-20',
    render: value => <span className='font-mono text-xs'>#{value}</span>
  }, {
    key: 'reportType',
    label: pbnT("m406"),
    width: 'w-25',
    render: value => <ReportTypeBadge type={value} />
  }, {
    key: 'target',
    label: pbnT("m451"),
    render: (_, row) => {
      if (!row.targetInfo) {
        return <span className='text-muted-foreground text-sm'>{pbnT("m435")}</span>;
      }
      return <div className='max-w-md'>
            {row.reportType === 'topic' && <Link href={getReportTargetLink(row)} className='text-primary hover:underline line-clamp-2 text-sm' target='_blank'>
                {row.targetInfo.title}
              </Link>}
            {row.reportType === 'post' && <Link href={getReportTargetLink(row)} className='text-primary hover:underline line-clamp-2 text-sm' target='_blank'>
                {row.targetInfo.content}
              </Link>}
            {row.reportType === 'user' && <Link href={getReportTargetLink(row)} className='text-primary hover:underline text-sm' target='_blank'>
                {row.targetInfo.username}
              </Link>}
          </div>;
    }
  }, {
    key: 'reporter',
    label: pbnT("m448"),
    width: 'w-30',
    render: (_, row) => <span className='text-sm'>
          {row.reporterName || row.reporterUsername}
        </span>
  }, {
    key: 'reason',
    label: pbnT("m450"),
    width: 'w-50',
    render: value => <div className='text-sm text-muted-foreground line-clamp-2'>
          {value}
        </div>
  }, {
    key: 'status',
    label: pbnT("m298"),
    width: 'w-30',
    render: value => <ReportStatusBadge status={value} />
  }, {
    key: 'createdAt',
    label: pbnT("m449"),
    width: 'w-[130px]',
    render: value => <span className='text-xs text-muted-foreground'>
          <Time date={value} />
        </span>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, row) => <ActionMenu items={[{
      label: pbnT("m465"),
      icon: Eye,
      onClick: () => openDetailDialog(row)
    }, {
      separator: true
    }, {
      label: pbnT("m457"),
      icon: CheckSquare,
      variant: 'default',
      onClick: () => openResolveDialog(row, 'resolve'),
      hidden: row.status !== 'pending'
    }, {
      label: pbnT("m458"),
      icon: XSquare,
      onClick: () => openResolveDialog(row, 'dismiss'),
      hidden: row.status !== 'pending'
    }]} />
  }];
  const tableFilters = [{
    value: filters.reportType,
    onChange: value => setFilter('reportType', value),
    options: [{
      value: 'all',
      label: pbnT("m418")
    }, {
      value: 'topic',
      label: pbnT("m68")
    }, {
      value: 'post',
      label: pbnT("m69")
    }, {
      value: 'user',
      label: pbnT("m70")
    }],
    width: 'w-full sm:w-[150px]'
  }, {
    value: filters.reportStatus,
    onChange: value => setFilter('reportStatus', value),
    options: [{
      value: 'all',
      label: pbnT("m419")
    }, {
      value: 'pending',
      label: pbnT("m443")
    }, {
      value: 'resolved',
      label: pbnT("m444")
    }, {
      value: 'dismissed',
      label: pbnT("m370")
    }],
    width: 'w-full sm:w-[150px]'
  }];
  return <div>
      <PageHeader title={pbnT("m466")} description={pbnT("m467")} />

      <DataTable columns={columns} data={reports} loading={loading} filters={tableFilters} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m468")
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} emptyMessage={pbnT("m469")} />

      <ReportResolveDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen} report={selectedReport} action={resolveAction} onResolve={handleResolve} resolving={resolving} />

      <ReportDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} report={detailReport} />
    </div>;
}
