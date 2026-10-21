'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { Button } from '@/components/ui/button';
import CopyButton from '@/components/common/CopyButton';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import UserAvatar from '@/components/user/UserAvatar';
import { confirm } from '@/components/common/ConfirmPopover';
import { FormDialog } from '@/components/common/FormDialog';
import { Ban, Check, Clock, TrendingUp, Users, Ticket, RotateCcw, Plus } from 'lucide-react';
import { invitationsApi } from '@/lib/api';
import { toast } from 'sonner';
import Time from '@/components/common/Time';
export function InvitationList() {
  const pbnT = usePbnTranslations();
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;
  const [generateForm, setGenerateForm] = useState({
    note: '',
    maxUses: 1,
    expireDays: 30
  });
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch]);
  useEffect(() => {
    fetchStats();
  }, []);
  useEffect(() => {
    fetchCodes();
  }, [page, statusFilter, debouncedSearch]);
  const fetchCodes = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await invitationsApi.admin.getAll(params);
      setCodes(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Could not load invitation codes:", err);
      toast.error(pbnT("m270"));
    } finally {
      setLoading(false);
    }
  };
  const fetchStats = async () => {
    try {
      const data = await invitationsApi.admin.getStats();
      setStats(data);
    } catch (err) {
      console.error("Could not load statistics:", err);
    }
  };
  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      const newCode = await invitationsApi.admin.generate(generateForm);
      toast.success(pbnT("m272"));
      setShowGenerateDialog(false);
      setGenerateForm({
        note: '',
        maxUses: 1,
        expireDays: 30
      });

      // 局部更新：将新生成的邀请码添加到列表顶部
      setCodes(prevCodes => [newCode, ...prevCodes]);
      setTotal(prevTotal => prevTotal + 1);

      // 局部更新统计数据
      setStats(prevStats => ({
        ...prevStats,
        totalCodes: prevStats.totalCodes + 1,
        activeCodes: prevStats.activeCodes + 1
      }));
    } catch (err) {
      console.error("Could not create invitation code:", err);
      toast.error(err.response?.data?.error || pbnT("m274"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDisableClick = async (e, code) => {
    const confirmed = await confirm(e, {
      title: pbnT("m275"),
      description: <>{pbnT("m276")}{code.code}{pbnT("m244")}<br />{pbnT("m277")}</>,
      confirmText: pbnT("m278"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const updatedCode = await invitationsApi.admin.disable(code.id);
      toast.success(pbnT("m279", {
        arg0: code.code
      }));

      // 局部更新：更新列表中被禁用的邀请码状态
      setCodes(prevCodes => prevCodes.map(c => c.id === code.id ? {
        ...c,
        status: 'disabled',
        ...updatedCode
      } : c));

      // 局部更新统计数据：活跃数减1
      setStats(prevStats => ({
        ...prevStats,
        activeCodes: Math.max(0, prevStats.activeCodes - 1)
      }));
    } catch (err) {
      console.error("Could not disable:", err);
      toast.error(err.message || pbnT("m281"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleEnableClick = async (e, code) => {
    const confirmed = await confirm(e, {
      title: pbnT("m282"),
      description: <>{pbnT("m283")}{code.code}{pbnT("m244")}<br />{pbnT("m284")}</>,
      confirmText: pbnT("m285"),
      variant: 'default',
      confirmClassName: 'bg-green-600 hover:bg-green-700'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const updatedCode = await invitationsApi.admin.enable(code.id);
      toast.success(pbnT("m286", {
        arg0: code.code
      }));

      // 局部更新：更新列表中被恢复的邀请码状态
      setCodes(prevCodes => prevCodes.map(c => c.id === code.id ? {
        ...c,
        status: 'active',
        ...updatedCode
      } : c));

      // 局部更新统计数据：活跃数加1
      setStats(prevStats => ({
        ...prevStats,
        activeCodes: prevStats.activeCodes + 1
      }));
    } catch (err) {
      console.error("Could not restore:", err);
      toast.error(err.message || pbnT("m288"));
    } finally {
      setSubmitting(false);
    }
  };
  const getStatusBadge = status => {
    const badges = {
      active: {
        label: pbnT("m289"),
        variant: 'default'
      },
      used: {
        label: pbnT("m290"),
        variant: 'secondary'
      },
      expired: {
        label: pbnT("m291"),
        variant: 'destructive'
      },
      disabled: {
        label: pbnT("m292"),
        variant: 'outline'
      }
    };
    const badge = badges[status] || badges.active;
    return <Badge variant={badge.variant} className="text-xs">
        {badge.label}
      </Badge>;
  };
  const formatDate = dateString => {
    if (!dateString) return '-';
    return <Time date={dateString} />;
  };
  return <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{pbnT("m293")}</p>
                <p className="text-2xl font-bold">{stats.totalCodes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{pbnT("m289")}</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeCodes}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Check className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{pbnT("m290")}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.usedCodes}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{pbnT("m294")}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalInvitedUsers}
                </p>
              </div>
            </div>
          </Card>
        </div>}

      {/* 邀请码表格 */}
      <DataTable columns={[{
      key: 'code',
      label: pbnT("m295"),
      width: 'w-[150px]',
      render: value => <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold bg-muted px-2 py-1 rounded">
                  {value}
                </code>
                <CopyButton value={value} variant="ghost" size="sm" className="h-6 w-6 p-0" iconSize="h-3 w-3" onCopy={() => toast.success(pbnT("m296"))} />
              </div>
    }, {
      key: 'creator',
      label: pbnT("m297"),
      width: 'w-[150px]',
      render: value => <div className="flex items-center gap-2">
                <UserAvatar url={value.avatar} name={value.name || value.username} size="xs" />
                <span className="text-sm">{value.username}</span>
              </div>
    }, {
      key: 'status',
      label: pbnT("m298"),
      width: 'w-25',
      render: value => getStatusBadge(value)
    }, {
      key: 'usage',
      label: pbnT("m299"),
      width: 'w-25',
      render: (_, code) => <span className="text-sm text-muted-foreground">
                {code.usedCount}/{code.maxUses}
              </span>
    }, {
      key: 'usedBy',
      label: pbnT("m300"),
      width: 'w-[150px]',
      render: value => value ? <div className="flex items-center gap-2">
                  <UserAvatar url={value.avatar} name={value.name || value.username} size="xs" />
                  <span className="text-sm">{value.username}</span>
                </div> : <span className="text-xs text-muted-foreground">-</span>
    }, {
      key: 'note',
      label: pbnT("m301"),
      render: value => value ? <span className="text-sm text-muted-foreground">{value}</span> : <span className="text-xs text-muted-foreground">-</span>
    }, {
      key: 'expiresAt',
      label: pbnT("m302"),
      width: 'w-30',
      render: value => <span className="text-xs text-muted-foreground flex items-center gap-1">
                {value ? <>
                    <Clock className="h-3 w-3" />
                    {formatDate(value)}
                  </> : '-'}
              </span>
    }, {
      key: 'createdAt',
      label: pbnT("m303"),
      width: 'w-30',
      render: value => <span className="text-xs text-muted-foreground">
                {formatDate(value)}
              </span>
    }, {
      key: 'actions',
      label: pbnT("m234"),
      align: 'right',
      sticky: 'right',
      render: (_, code) => <ActionMenu mode="inline" items={[{
        label: pbnT("m304"),
        icon: Ban,
        onClick: e => handleDisableClick(e, code),
        variant: 'destructive',
        hidden: code.status !== 'active'
      }, {
        label: pbnT("m305"),
        icon: RotateCcw,
        onClick: e => handleEnableClick(e, code),
        hidden: code.status !== 'disabled' || code.usedCount >= code.maxUses || code.expiresAt && new Date(code.expiresAt) <= new Date()
      }]} />
    }]} data={codes} loading={loading} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m306")
    }} filter={{
      value: statusFilter,
      onChange: value => {
        setStatusFilter(value);
      },
      options: [{
        value: 'all',
        label: pbnT("m307")
      }, {
        value: 'active',
        label: pbnT("m289")
      }, {
        value: 'used',
        label: pbnT("m290")
      }, {
        value: 'expired',
        label: pbnT("m291")
      }, {
        value: 'disabled',
        label: pbnT("m292")
      }]
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} actions={<Button onClick={() => setShowGenerateDialog(true)}>
            <Plus className="h-4 w-4" />{pbnT("m308")}</Button>} emptyMessage={pbnT("m309")} />

      {/* 生成邀请码对话框 */}
      <FormDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog} title={pbnT("m308")} description={pbnT("m310")} submitText={pbnT("m311")} onSubmit={handleGenerate} loading={submitting}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">{pbnT("m312")}</Label>
              <Input id="note" placeholder={pbnT("m313")} value={generateForm.note} onChange={e => setGenerateForm({
            ...generateForm,
            note: e.target.value
          })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">{pbnT("m314")}</Label>
              <Input id="maxUses" type="number" min="1" value={generateForm.maxUses} onChange={e => setGenerateForm({
            ...generateForm,
            maxUses: parseInt(e.target.value) || 1
          })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expireDays">{pbnT("m315")}</Label>
              <Input id="expireDays" type="number" min="1" value={generateForm.expireDays} onChange={e => setGenerateForm({
            ...generateForm,
            expireDays: parseInt(e.target.value) || 30
          })} />
            </div>
          </div>
      </FormDialog>
    </div>;
}
