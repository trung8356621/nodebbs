'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { confirm } from '@/components/common/ConfirmPopover';
import { Key, Pencil, Trash2, Plus } from 'lucide-react';
import { rbacApi } from '@/lib/api';
import { toast } from 'sonner';
export function PermissionsTab() {
  const pbnT = usePbnTranslations();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('all');

  // RBAC 配置（从后端获取）
  const [rbacConfig, setRbacConfig] = useState({
    modules: [],
    commonActions: [],
    moduleSpecialActions: {},
    conditionTypes: []
  });
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    module: '',
    action: ''
  });
  useEffect(() => {
    fetchConfig();
  }, []);

  // 获取 RBAC 配置
  const fetchConfig = async () => {
    try {
      const config = await rbacApi.getConfig();
      setRbacConfig(config);
      // 设置默认值
      if (config.modules?.length > 0 && config.commonActions?.length > 0) {
        setForm(prev => ({
          ...prev,
          module: prev.module || config.modules[0].value,
          action: prev.action || config.commonActions[0].value
        }));
      }
      // 配置加载完成后获取权限列表
      fetchData();
    } catch (err) {
      console.error("Could not load RBAC configuration:", err);
      toast.error(pbnT("m488"));
    }
  };
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await rbacApi.admin.getPermissions();
      const perms = data.permissions || [];
      setPermissions(perms);
    } catch (err) {
      console.error("Could not load permissions:", err);
      toast.error(pbnT("m490"));
    } finally {
      setLoading(false);
    }
  };

  // 获取操作标签
  const getActionLabel = useMemo(() => {
    const allActions = [...rbacConfig.commonActions, ...Object.values(rbacConfig.moduleSpecialActions).flat()];
    return action => {
      const found = allActions.find(a => a.value === action);
      return found ? found.label : action;
    };
  }, [rbacConfig]);

  // 获取模块标签
  const getModuleLabel = module => {
    const option = rbacConfig.modules.find(o => o.value === module);
    return option ? option.label : module;
  };
  const openCreateDialog = () => {
    setDialogMode('create');
    setForm({
      slug: '',
      name: '',
      description: '',
      module: rbacConfig.modules[0]?.value || 'topic',
      action: rbacConfig.commonActions[0]?.value || 'read'
    });
    setShowDialog(true);
  };
  const openEditDialog = permission => {
    setDialogMode('edit');
    setSelectedPermission(permission);
    setForm({
      slug: permission.slug,
      name: permission.name,
      description: permission.description || '',
      module: permission.module,
      action: permission.action
    });
    setShowDialog(true);
  };
  const handleSubmit = async () => {
    if (!form.slug || !form.name || !form.module || !form.action) {
      toast.error(pbnT("m491"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        await rbacApi.admin.createPermission(form);
        toast.success(pbnT("m492"));
      } else {
        await rbacApi.admin.updatePermission(selectedPermission.id, form);
        toast.success(pbnT("m493"));
      }
      setShowDialog(false);
      fetchData();
    } catch (err) {
      console.error("Could not save permission:", err);
      toast.error(err.message || pbnT("m495"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (e, permission) => {
    if (permission.isSystem) {
      toast.error(pbnT("m496"));
      return;
    }
    const confirmed = await confirm(e, {
      title: pbnT("m497"),
      description: pbnT("m498", {
        arg0: permission.name
      }),
      confirmText: pbnT("m246"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await rbacApi.admin.deletePermission(permission.id);
      toast.success(pbnT("m499"));
      fetchData();
    } catch (err) {
      console.error("Could not delete permission:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };

  // 根据模块和操作自动生成 slug
  const generateSlug = (module, action) => {
    return `${module}.${action}`;
  };

  // 当模块改变时更新 slug 和检查 action 有效性
  const handleModuleChange = value => {
    const specialActions = rbacConfig.moduleSpecialActions[value] || [];
    const allActions = [...rbacConfig.commonActions, ...specialActions];
    const isActionValid = allActions.some(a => a.value === form.action);
    const newAction = isActionValid ? form.action : rbacConfig.commonActions[0]?.value || 'read';
    const newSlug = generateSlug(value, newAction);
    setForm({
      ...form,
      module: value,
      action: newAction,
      slug: newSlug
    });
  };
  const handleActionChange = value => {
    const newSlug = generateSlug(form.module, value);
    setForm({
      ...form,
      action: value,
      slug: newSlug
    });
  };

  // 过滤后的权限列表
  const filteredPermissions = moduleFilter === 'all' ? permissions : permissions.filter(p => p.module === moduleFilter);

  // 当前模块的特殊操作
  const currentSpecialActions = rbacConfig.moduleSpecialActions[form.module] || [];
  return <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />{pbnT("m501")}</Button>
      </div>

      <DataTable columns={[{
      key: 'name',
      label: pbnT("m502"),
      render: (_, permission) => <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{permission.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{permission.slug}</div>
                </div>
              </div>
    }, {
      key: 'module',
      label: pbnT("m503"),
      width: 'w-25',
      render: value => <Badge variant="outline">{getModuleLabel(value)}</Badge>
    }, {
      key: 'action',
      label: pbnT("m234"),
      width: 'w-25',
      render: value => <span className="text-sm text-muted-foreground">{getActionLabel(value)}</span>
    }, {
      key: 'description',
      label: pbnT("m218"),
      render: value => <span className="text-sm text-muted-foreground">
                {value || '-'}
              </span>
    }, {
      key: 'isSystem',
      label: pbnT("m406"),
      width: 'w-20',
      render: value => value ? <Badge variant="secondary" className="text-xs">{pbnT("m504")}</Badge> : <Badge variant="outline" className="text-xs">{pbnT("m505")}</Badge>
    }, {
      key: 'actions',
      label: pbnT("m234"),
      align: 'right',
      sticky: 'right',
      render: (_, permission) => <ActionMenu items={[{
        label: pbnT("m235"),
        icon: Pencil,
        onClick: () => openEditDialog(permission),
        disabled: permission.isSystem
      }, {
        separator: true
      }, {
        label: pbnT("m110"),
        icon: Trash2,
        variant: 'destructive',
        onClick: e => handleDelete(e, permission),
        disabled: permission.isSystem
      }]} />
    }]} data={filteredPermissions} loading={loading} filter={{
      value: moduleFilter,
      onChange: setModuleFilter,
      options: [{
        value: 'all',
        label: pbnT("m506")
      }, ...rbacConfig.modules.map(o => ({
        value: o.value,
        label: o.label
      }))]
    }} emptyMessage={pbnT("m507")} />

      {/* 创建/编辑权限对话框 */}
      <FormDialog open={showDialog} onOpenChange={setShowDialog} title={dialogMode === 'create' ? pbnT("m501") : pbnT("m508")} description={dialogMode === 'create' ? pbnT("m509") : pbnT("m510")} submitText={dialogMode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleSubmit} loading={submitting} maxWidth="sm:max-w-125">
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module">{pbnT("m503")}<span className="text-destructive">*</span>
              </Label>
              <Select value={form.module} onValueChange={handleModuleChange} disabled={submitting || dialogMode === 'edit' && selectedPermission?.isSystem}>
                <SelectTrigger id="module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rbacConfig.modules.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">{pbnT("m234")}<span className="text-destructive">*</span>
              </Label>
              <Select value={form.action} onValueChange={handleActionChange} disabled={submitting || dialogMode === 'edit' && selectedPermission?.isSystem}>
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{pbnT("m511")}</SelectLabel>
                    {rbacConfig.commonActions.map(option => <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>)}
                  </SelectGroup>
                  {currentSpecialActions.length > 0 && <SelectGroup>
                      <SelectLabel>{pbnT("m512")}</SelectLabel>
                      {currentSpecialActions.map(option => <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>)}
                    </SelectGroup>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{pbnT("m513")}<span className="text-destructive">*</span>
            </Label>
            <Input id="slug" placeholder={pbnT("m514")} value={form.slug} onChange={e => setForm({
            ...form,
            slug: e.target.value
          })} disabled={submitting || dialogMode === 'edit' && selectedPermission?.isSystem} />
            <p className="text-xs text-muted-foreground">{pbnT("m515")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{pbnT("m230")}<span className="text-destructive">*</span>
            </Label>
            <Input id="name" placeholder={pbnT("m516")} value={form.name} onChange={e => setForm({
            ...form,
            name: e.target.value
          })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{pbnT("m218")}</Label>
            <Textarea id="description" placeholder={pbnT("m517")} value={form.description} onChange={e => setForm({
            ...form,
            description: e.target.value
          })} disabled={submitting} />
          </div>
        </div>
      </FormDialog>
    </div>;
}
