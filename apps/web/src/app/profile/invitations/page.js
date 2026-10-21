'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDialog } from '@/components/common/FormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { Plus, Clock, Ticket, Calendar, Users, CheckCircle2, XCircle, Copy, Check, Sparkles } from 'lucide-react';
import CopyButton from '@/components/common/CopyButton';
import { Loading } from '@/components/common/Loading';
import { Pager } from '@/components/common/Pagination';

// 导入 Hook
import { useInvitations } from '@/hooks/profile/useInvitations';

/**
 * 邀请码页面
 * 优化版 UI - Pro Max 设计风格
 */
export default function InvitationsPage() {
  const pbnT = usePbnTranslations();
  const {
    // 列表数据
    codes,
    stats,
    quota,
    loading,
    page,
    pageSize,
    total,
    statusFilter,
    setPage,
    setStatusFilter,
    // 生成对话框
    isGenerateDialogOpen,
    setIsGenerateDialogOpen,
    generating,
    generateForm,
    updateGenerateForm,
    handleGenerate,
    // 工具函数
    getStatusBadgeProps,
    formatDate,
    // 派生状态
    canGenerate
  } = useInvitations();

  // 渲染状态标签 - 使用 Badge 组件
  const renderStatusBadge = status => {
    const config = {
      active: {
        label: pbnT("m289"),
        variant: 'default',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
        icon: CheckCircle2
      },
      used: {
        label: pbnT("m290"),
        variant: 'secondary',
        className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        icon: Users
      },
      expired: {
        label: pbnT("m291"),
        variant: 'outline',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: Clock
      }
    };
    const {
      label,
      className,
      icon: Icon
    } = config[status] || config.active;
    return <Badge variant="outline" className={`gap-1 font-medium ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>;
  };

  // 初始加载状态：显示 PageHeader + 内容区 loading
  const isInitialLoading = loading && !codes.length;
  return <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader title={pbnT("m934")} description={pbnT("m935")} actions={<Button onClick={() => setIsGenerateDialogOpen(true)} disabled={!canGenerate} className="gap-2">
            <Plus className="h-4 w-4" />{pbnT("m308")}</Button>} />

      {/* 初始加载状态 */}
      {isInitialLoading ? <Loading text={pbnT("m71")} className="min-h-75" /> : <>
          {/* 统计卡片区域 */}
          {quota ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 今日剩余 */}
          <Card className="relative overflow-hidden border-0 bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{pbnT("m936")}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {quota.todayRemaining}
                    <span className="text-sm font-normal text-muted-foreground">/{quota.dailyLimit}</span>
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
              </div>
              {/* 进度条 */}
              <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{
                width: `${quota.todayRemaining / quota.dailyLimit * 100}%`
              }} />
              </div>
            </CardContent>
          </Card>

          {/* 总计 */}
          <Card className="border-0 bg-muted/30 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{pbnT("m937")}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{stats?.total || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 活跃 */}
          <Card className="border-0 bg-emerald-500/5 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{pbnT("m289")}</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {stats?.active || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 已使用 */}
          <Card className="border-0 bg-blue-500/5 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{pbnT("m290")}</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400 tabular-nums">
                    {stats?.used || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div> : !loading && <Card className="border-destructive/20 bg-destructive/5 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">{pbnT("m938")}</p>
                <p className="text-sm text-muted-foreground">{pbnT("m939")}</p>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* 邀请规则：生成消耗 / 邀请奖励（值 > 0 才显示，均为 0 则整块不渲染） */}
      {quota && (quota.pointsCost > 0 || quota.rewardAmount > 0) && <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {quota.pointsCost > 0 && <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{pbnT("m345")}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {quota.pointsCost} {quota.currencyName}
                  </span>
                  <span className="text-xs text-muted-foreground">{pbnT("m940")}</span>
                </div>}
              {quota.rewardAmount > 0 && <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{pbnT("m941")}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{quota.rewardAmount} {quota.currencyName}
                  </span>
                  <span className="text-xs text-muted-foreground">{pbnT("m942")}</span>
                </div>}
            </div>
          </CardContent>
        </Card>}

      {/* 筛选器 */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-35 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pbnT("m419")}</SelectItem>
            <SelectItem value="active">{pbnT("m289")}</SelectItem>
            <SelectItem value="used">{pbnT("m290")}</SelectItem>
            <SelectItem value="expired">{pbnT("m291")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{pbnT("m75")}{" "}{total}{" "}{pbnT("m943")}</span>
      </div>

      {/* 邀请码列表 */}
      <div className="space-y-3">
        {codes.length === 0 && !loading ? <Card className="shadow-none border-dashed">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Ticket className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-4">{pbnT("m944")}</p>
              <Button onClick={() => setIsGenerateDialogOpen(true)} disabled={!canGenerate} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />{pbnT("m945")}</Button>
            </CardContent>
          </Card> : loading ? <Loading text={pbnT("m71")} className="min-h-50" /> : codes.map(code => <Card key={code.id} className="group shadow-none hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* 左侧：邀请码和状态 */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <Ticket className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-base font-mono font-bold tracking-wider">
                          {code.code}
                        </code>
                        {renderStatusBadge(code.status)}
                      </div>
                      {code.note && <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {code.note}
                        </p>}
                    </div>
                  </div>

                  {/* 中间：元信息 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap sm:flex-nowrap">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {code.usedCount}/{code.maxUses}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(code.createdAt)}
                    </span>
                    {code.expiresAt && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(code.expiresAt)}
                      </span>}
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="shrink-0">
                    <CopyButton value={code.code} variant="outline" size="sm" className="h-8 w-18 gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      {({
                    copied
                  }) => copied ? <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-600">{pbnT("m154")}</span>
                          </> : <>
                            <Copy className="h-3.5 w-3.5" />{pbnT("m155")}</>}
                    </CopyButton>
                  </div>
                </div>

                {/* 使用者信息 */}
                {code.usedBy && <div className="mt-3 pt-3 border-t border-dashed flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{pbnT("m946")}</span>
                    <span className="font-medium">{code.usedBy.username}</span>
                    <span className="text-muted-foreground text-xs">{pbnT("m947")}{" "}{formatDate(code.usedAt)}
                    </span>
                  </div>}
              </CardContent>
            </Card>)}
      </div>

      {/* 分页 */}
      {total > pageSize && <Pager total={total} page={page} pageSize={pageSize} onPageChange={newPage => setPage(newPage)} />}

      {/* 生成邀请码对话框 */}
      <FormDialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen} title={pbnT("m308")} description={pbnT("m948")} submitText={generating ? pbnT("m949") : pbnT("m311")} onSubmit={handleGenerate} loading={generating}>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="count">{pbnT("m950")}</Label>
            <Input id="count" type="number" min="1" max={quota?.todayRemaining || 1} value={generateForm.count} onChange={e => updateGenerateForm('count', parseInt(e.target.value) || 1)} className="tabular-nums" />
            {quota && <p className="text-xs text-muted-foreground">{pbnT("m936")}{" "}{quota.todayRemaining}{" "}{pbnT("m332")}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{pbnT("m312")}</Label>
            <Input id="note" placeholder={pbnT("m951")} value={generateForm.note} onChange={e => updateGenerateForm('note', e.target.value)} />
            {generateForm.count > 1 && <p className="text-xs text-muted-foreground">{pbnT("m952")}</p>}
          </div>

          {quota && <Card className="bg-muted/30 border-0 shadow-none">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">{pbnT("m953")}</p>
                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{pbnT("m331")}</span>
                    <span className="font-medium text-foreground">{quota.dailyLimit}{" "}{pbnT("m332")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{pbnT("m936")}</span>
                    <span className="font-medium text-foreground">{quota.todayRemaining}{" "}{pbnT("m332")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{pbnT("m825")}</span>
                    <span className="font-medium text-foreground">{quota.maxUsesPerCode}{" "}{pbnT("m334")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{pbnT("m335")}</span>
                    <span className="font-medium text-foreground">{quota.expireDays}{" "}{pbnT("m336")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>}
        </div>
      </FormDialog>
        </>}
    </div>;
}
