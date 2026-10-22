import { usePbnTranslations } from "@/i18n/useTranslations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/common/DataTable';
import { Loading } from '@/components/common/Loading';
import {getTransactionTypeLabel} from '../../utils/transactionTypes';
import { TransactionTypeBadge } from './TransactionTypeBadge';
import Time from '@/components/common/Time';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// 简单的辅助函数，避免依赖 rewards 扩展
function formatAmount(amount) {
  if (typeof amount !== 'number') return '0';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString()}`;
}
function getAmountColorClass(amount) {
  if (amount > 0) return 'text-green-600';
  if (amount < 0) return 'text-red-600';
  return 'text-muted-foreground';
}

/**
 * 带有搜索功能的账本交易历史表格 (通用版)
 * @param {Object} props
 * @param {Array} props.transactions - 交易记录数组
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.pagination - 分页信息 { page, total, limit, onPageChange }
 * @param {boolean} [props.showUserColumn=true] - 是否显示用户列 (用户自己查看时不需要)
 * @param {boolean} [props.compact=false] - 是否紧凑模式 (无 Card 外壳)
 */
export function LedgerTransactionTable({
  transactions,
  loading,
  pagination,
  showUserColumn = true,
  compact = false
}) {
  const pbnT = usePbnTranslations();
  const columns = [{
    label: 'ID',
    key: 'id',
    render: value => <span className="text-muted-foreground">#{value}</span>
  }, ...(showUserColumn ? [{
    label: pbnT("m70"),
    key: 'username',
    render: (value, row) => <a href={`/users/${row.username}`} className="hover:underline text-primary" target="_blank" rel="noopener noreferrer">
          {row.username}
        </a>
  }] : []), {
    label: pbnT("m1863"),
    key: 'currencyName',
    render: (value, row) => <span className="text-sm" title={row.currencyCode}>
          {row.currencyCode==='credits'?'Credit':value || row.currencyCode}
        </span>
  }, {
    label: pbnT("m406"),
    key: 'type',
    render: (value, row) => {
      let meta = row.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          // ignore error
        }
      }
      return <TransactionTypeBadge type={value} amount={row.amount} meta={meta} />;
    }
  }, {
    label: pbnT("m1864"),
    key: 'amount',
    render: value => <span className={`font-semibold ${getAmountColorClass(value)}`}>
          {formatAmount(value)}
        </span>
  }, {
    label: pbnT("m1865"),
    key: 'balance',
    render: value => <span className="font-medium">{value}</span>
  }, {
    label: pbnT("m218"),
    key: 'description',
    render: (value, row) => {
      let meta = row.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          console.error('Failed to parse metadata:', e);
        }
      }
      if(['check_in','post_topic','post_reply'].includes(row.type)){
        const title=row.type==='post_topic'?String(value||'').replace(/^[^:：]*[:：]\s*/,''):'';
        return <span>{getTransactionTypeLabel(row.type,pbnT)}{title?' · '+title:''}</span>;
      }
      if(row.type==='seo_purchase')return <a href={`/topic/${meta?.topicId}`} title={row.referenceId} className='underline'>{pbnT('seoTitle')} · #{meta?.topicId} · v{meta?.priceVersion}</a>;
      if(row.type==='seo_correction')return <span>{pbnT('pinCorrect')}: {meta?.reason}</span>;
      if(row.type==='pin_purchase')return <a href={`/topic/${meta?.topicId}`} title={row.referenceId} className='underline'>{pbnT('pinTitle')} · #{meta?.topicId}</a>;
      if(row.type==='pin_correction')return <span>{pbnT('pinCorrect')}: {meta?.reason}</span>;
      const hasBonus = meta && meta.effectBonus > 0;

      // 检查特定交易类型
      // 1. 帖子打赏
      if (row.type === 'reward_post') {
        const isTopic = meta.isTopic;
        const topicId = meta.topicId;
        const relatedPostId = meta.relatedPostId; // 这里实际上是 postId
        const isIncoming = row.amount > 0; // 正数表示收入

        let text = isIncoming ? isTopic ? pbnT("m1866") : pbnT("m1867") : isTopic ? pbnT("m1868") : pbnT("m1869");

        // 兼容旧数据（没有 meta.isTopic 的情况）
        if (meta.isTopic === undefined && !meta.topicId) {
          text = meta.message || (isIncoming ? pbnT("m1870") : pbnT("m1871"));
        }

        // 如果存在勋章加成信息（来自之前的任务）
        const badgeInfo = hasBonus ? <span className="ml-2 text-xs text-amber-600 font-medium whitespace-nowrap">{pbnT("m1872")}{meta.effectBonus})
                 </span> : null;
        if (topicId) {
          // 使用 relatedPostId (postId) 作为锚点，以满足 TopicPageClient 的要求
          const anchor = relatedPostId ? `#post-${relatedPostId}` : '';
          return <div className="flex flex-col">
                        <span className="text-sm">
                            <a href={`/topic/${topicId}${anchor}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">
                                {text}
                            </a>
                            {badgeInfo}
                        </span>
                        {meta.message && <span className="text-xs text-muted-foreground line-clamp-1">{pbnT("m1873")}{" "}{meta.message}
                            </span>}
                    </div>;
        }
      }
      return <div className="flex flex-col">
            <span className="text-sm text-muted-foreground line-clamp-1">
              {value || '-'}
              {hasBonus && <span className="ml-2 text-xs text-amber-600 font-medium">{pbnT("m1872")}{meta.effectBonus})
                </span>}
            </span>
          </div>;
    }
  }, {
    label: pbnT("m1874"),
    key: 'createdAt',
    render: value => <Time date={value} fromNow />
  }];
  const content = loading ? <div className="bg-card border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => <TableHead key={index} className={column.width}>
                {column.label}
              </TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({
          length: 5
        }).map((_, rowIndex) => <TableRow key={rowIndex}>
              {columns.map((column, colIndex) => <TableCell key={colIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>)}
            </TableRow>)}
        </TableBody>
      </Table>
    </div> : <DataTable columns={columns} data={transactions} pagination={pagination} emptyMessage={pbnT("m1875")} />;
  if (compact) {
    return content;
  }
  return <Card className="shadow-none bg-transparent border-0">
      <CardHeader className="px-0">
          <CardTitle>{pbnT("m1876")}</CardTitle>
          <CardDescription>{pbnT("m1877")}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {content}
      </CardContent>
    </Card>;
}
