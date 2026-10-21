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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { confirm } from '@/components/common/ConfirmPopover';
import { Shield, Pencil, Trash2, Plus, Key } from 'lucide-react';
import { rbacApi, categoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConditionEditor } from './ConditionEditor';
export function RolesTab() {
  const pbnT = usePbnTranslations();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedRole, setSelectedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // RBAC 配置（从后端获取）
  const [conditionTypes, setConditionTypes] = useState({});
  // 权限 → 条件定义列表，每项形如 { key, options?, defaultValue? }
  const [permissionConditions, setPermissionConditions] = useState({});
  const [moduleOptions, setModuleOptions] = useState([]);
  const [commonActions, setCommonActions] = useState([]);
  const [moduleSpecialActions, setModuleSpecialActions] = useState({});
  const [allowedRolePermissions, setAllowedRolePermissions] = useState({});

  // 动态数据源（用于条件编辑器）
  const [dynamicDataSources, setDynamicDataSources] = useState({
    categories: [] // 分类列表
  });
  const actionWeightMap = useMemo(() => {
    const commonWeights = {};
    commonActions.forEach((action, index) => {
      commonWeights[action.value] = index + 1;
    });
    const moduleWeights = {};
    const offset = commonActions.length + 1;
    Object.entries(moduleSpecialActions).forEach(([module, actions]) => {
      moduleWeights[module] = {};
      actions.forEach((action, index) => {
        moduleWeights[module][action.value] = offset + index;
      });
    });
    return {
      common: commonWeights,
      modules: moduleWeights
    };
  }, [commonActions, moduleSpecialActions]);
  const [roleForm, setRoleForm] = useState({
    slug: '',
    name: '',
    description: '',
    color: '#000000',
    icon: '',
    isDefault: false,
    isDisplayed: true,
    priority: 0
  });
  const [rolePermissions, setRolePermissions] = useState([]); // [{ permissionId, conditions }]

  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData, configData, categoriesData] = await Promise.all([rbacApi.admin.getRoles(), rbacApi.admin.getPermissions(), rbacApi.getConfig(), categoryApi.getAll().catch(() => [])]);
      setRoles(rolesData);
      setPermissions(permsData.permissions || []);
      setConditionTypes(configData.conditionTypes || {});
      setPermissionConditions(configData.permissionConditions || {});
      setModuleOptions(configData.modules || []);
      setCommonActions(configData.commonActions || []);
      setModuleSpecialActions(configData.moduleSpecialActions || {});
      setAllowedRolePermissions(configData.allowedRolePermissions || {});

      // 设置动态数据源（只显示父分类，子分类自动继承权限）
      setDynamicDataSources({
        categories: categoriesData.filter(cat => !cat.parentId).map(cat => ({
          value: cat.id,
          label: cat.name
        }))
      });
    } catch (err) {
      console.error("Could not load data:", err);
      toast.error(pbnT("m519"));
    } finally {
      setLoading(false);
    }
  };
  const openCreateDialog = () => {
    setDialogMode('create');
    setSelectedRole(null);
    setRoleForm({
      slug: '',
      name: '',
      description: '',
      color: '#000000',
      icon: '',
      isDefault: false,
      isDisplayed: true,
      priority: 0
    });
    setShowRoleDialog(true);
  };
  const openEditDialog = role => {
    setDialogMode('edit');
    setSelectedRole(role);
    setRoleForm({
      slug: role.slug,
      name: role.name,
      description: role.description || '',
      color: role.color || '#000000',
      icon: role.icon || '',
      isDefault: role.isDefault,
      isDisplayed: role.isDisplayed,
      priority: role.priority
    });
    setShowRoleDialog(true);
  };
  const openPermissionDialog = async role => {
    setSelectedRole(role);
    try {
      const perms = await rbacApi.admin.getRolePermissions(role.id);

      // 转换为 { permissionId, conditions } 格式
      setRolePermissions(perms.map(p => ({
        permissionId: p.id,
        conditions: typeof p.conditions === 'string' ? JSON.parse(p.conditions) : p.conditions || null
      })));
    } catch (err) {
      console.error("Could not load role permissions:", err);
      setRolePermissions([]);
    }
    setShowPermissionDialog(true);
  };
  const handleSubmitRole = async () => {
    if (!roleForm.slug || !roleForm.name) {
      toast.error(pbnT("m521"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        await rbacApi.admin.createRole(roleForm);
        toast.success(pbnT("m522"));
      } else {
        await rbacApi.admin.updateRole(selectedRole.id, roleForm);
        toast.success(pbnT("m523"));
      }
      setShowRoleDialog(false);
      fetchData();
    } catch (err) {
      console.error("Could not save role:", err);
      toast.error(err.message || pbnT("m495"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDeleteRole = async (e, role) => {
    if (role.isSystem) {
      toast.error(pbnT("m525"));
      return;
    }
    const confirmed = await confirm(e, {
      title: pbnT("m526"),
      description: pbnT("m527", {
        arg0: role.name
      }),
      confirmText: pbnT("m246"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await rbacApi.admin.deleteRole(role.id);
      toast.success(pbnT("m528"));
      fetchData();
    } catch (err) {
      console.error("Could not delete role:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };
  const handleSavePermissions = async () => {
    setSubmitting(true);
    try {
      await rbacApi.admin.setRolePermissions(selectedRole.id, rolePermissions.map(rp => ({
        permissionId: rp.permissionId,
        conditions: rp.conditions
      })));
      toast.success(pbnT("m530"));
      setShowPermissionDialog(false);
    } catch (err) {
      console.error("Could not save permission:", err);
      toast.error(err.message || pbnT("m495"));
    } finally {
      setSubmitting(false);
    }
  };
  const togglePermission = permId => {
    setRolePermissions(prev => {
      const existing = prev.find(rp => rp.permissionId === permId);
      if (existing) {
        return prev.filter(rp => rp.permissionId !== permId);
      }
      return [...prev, {
        permissionId: permId,
        conditions: null
      }];
    });
  };

  // 更新权限的条件
  const updatePermissionConditions = (permId, conditions) => {
    setRolePermissions(prev => prev.map(rp => {
      if (rp.permissionId === permId) {
        return {
          ...rp,
          conditions
        };
      }
      return rp;
    }));
  };

  // 检查权限是否已选中
  const isPermissionSelected = permId => {
    return rolePermissions.some(rp => rp.permissionId === permId);
  };

  // 获取权限的条件
  const getPermissionConditions = permId => {
    const rp = rolePermissions.find(rp => rp.permissionId === permId);
    return rp?.conditions || null;
  };

  // 按模块分组权限
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {});

  // 获取权限支持的条件类型列表
  const getPermissionConditionTypes = permissionSlug => {
    // 该权限声明的条件列表，每项形如 { key, options?, defaultValue? }
    const declared = permissionConditions[permissionSlug];
    if (!declared || declared.length === 0) {
      return [];
    }
    // key 指向 conditionTypes 里的通用定义，同项的其余字段是该权限下的特化，合并其上。
    // 同一条件在不同权限下可以不一样：如「允许的文件类型」，图片类上传只列图片扩展名、
    // 附件给更宽的候选，两者留空时生效的兜底值（defaultValue）也不同
    const allTypes = declared.map(({
      key,
      ...scoped
    }) => {
      const def = conditionTypes[key];
      if (!def) return null;
      return {
        key,
        ...def,
        ...scoped
      };
    }).filter(Boolean);

    // 如果没有选中角色，返回所有类型
    if (!selectedRole?.slug) {
      return allTypes;
    }

    // 过滤条件类型
    return allTypes.filter(type => {
      // 检查 excludeRoles：完全排除某些角色
      if (type.excludeRoles?.includes(selectedRole.slug)) {
        return false;
      }
      return true;
    });
  };

  /**
   * 排序权限列表：按照配置返回的 commonActions 和 moduleSpecialActions 顺序
   */
  const sortPermissions = (perms, module) => {
    if (!perms) return [];
    return [...perms].sort((a, b) => {
      const weightA = actionWeightMap.common[a.action] || actionWeightMap.modules[module]?.[a.action] || 999;
      const weightB = actionWeightMap.common[b.action] || actionWeightMap.modules[module]?.[b.action] || 999;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.slug.localeCompare(b.slug);
    });
  };
  return <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />{pbnT("m531")}</Button>
      </div>

      <DataTable columns={[{
      key: 'name',
      label: pbnT("m341"),
      render: (_, role) => <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
          backgroundColor: role.color || '#e5e7eb'
        }}>
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium">{role.name}</div>
                  <div className="text-xs text-muted-foreground">{role.slug}</div>
                </div>
              </div>
    }, {
      key: 'description',
      label: pbnT("m218"),
      render: value => <span className="text-sm text-muted-foreground">
                {value || '-'}
              </span>
    }, {
      key: 'priority',
      label: pbnT("m532"),
      width: 'w-20',
      render: value => <Badge variant="outline">{value}</Badge>
    }, {
      key: 'flags',
      label: pbnT("m533"),
      render: (_, role) => <div className="flex gap-1 flex-wrap">
                {role.isSystem && <Badge variant="secondary" className="text-xs">{pbnT("m504")}</Badge>}
                {role.isDefault && <Badge variant="default" className="text-xs">{pbnT("m534")}</Badge>}
                {role.isDisplayed && <Badge variant="outline" className="text-xs">{pbnT("m535")}</Badge>}
              </div>
    }, {
      key: 'actions',
      label: pbnT("m234"),
      align: 'right',
      sticky: 'right',
      render: (_, role) => <ActionMenu items={[{
        label: pbnT("m536"),
        icon: Pencil,
        onClick: () => openEditDialog(role)
      }, {
        label: pbnT("m537"),
        icon: Key,
        onClick: () => openPermissionDialog(role)
      }, {
        separator: true
      }, {
        label: pbnT("m538"),
        icon: Trash2,
        variant: 'destructive',
        onClick: e => handleDeleteRole(e, role),
        disabled: role.isSystem
      }]} />
    }]} data={roles} loading={loading} emptyMessage={pbnT("m539")} />

      {/* 创建/编辑角色对话框 */}
      <FormDialog open={showRoleDialog} onOpenChange={setShowRoleDialog} title={dialogMode === 'create' ? pbnT("m531") : pbnT("m536")} description={dialogMode === 'create' ? pbnT("m540") : pbnT("m541")} submitText={dialogMode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleSubmitRole} loading={submitting} maxWidth="sm:max-w-125">
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">{pbnT("m513")}<span className="text-destructive">*</span>
              </Label>
              <Input id="slug" placeholder={pbnT("m542")} value={roleForm.slug} onChange={e => setRoleForm({
              ...roleForm,
              slug: e.target.value
            })} disabled={submitting || dialogMode === 'edit' && selectedRole?.isSystem} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{pbnT("m230")}<span className="text-destructive">*</span>
              </Label>
              <Input id="name" placeholder={pbnT("m543")} value={roleForm.name} onChange={e => setRoleForm({
              ...roleForm,
              name: e.target.value
            })} disabled={submitting} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{pbnT("m218")}</Label>
            <Textarea id="description" placeholder={pbnT("m544")} value={roleForm.description} onChange={e => setRoleForm({
            ...roleForm,
            description: e.target.value
          })} disabled={submitting} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">{pbnT("m220")}</Label>
              <Input id="color" type="color" value={roleForm.color} onChange={e => setRoleForm({
              ...roleForm,
              color: e.target.value
            })} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{pbnT("m532")}</Label>
              <Input id="priority" type="number" value={roleForm.priority} onChange={e => setRoleForm({
              ...roleForm,
              priority: parseInt(e.target.value) || 0
            })} disabled={submitting} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox id="isDefault" checked={roleForm.isDefault} onCheckedChange={checked => setRoleForm({
              ...roleForm,
              isDefault: checked
            })} disabled={submitting} />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">{pbnT("m545")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="isDisplayed" checked={roleForm.isDisplayed} onCheckedChange={checked => setRoleForm({
              ...roleForm,
              isDisplayed: checked
            })} disabled={submitting} />
              <Label htmlFor="isDisplayed" className="text-sm font-normal cursor-pointer">{pbnT("m546")}</Label>
            </div>
          </div>
        </div>
      </FormDialog>

      {/* 权限配置对话框 */}
      <FormDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog} title={pbnT("m547", {
      arg0: selectedRole?.name || ''
    })} description={pbnT("m548")} submitText={pbnT("m210")} onSubmit={handleSavePermissions} loading={submitting} maxWidth="sm:max-w-3xl">
        <div className="space-y-4 py-4">
          {moduleOptions.map(({
          value: moduleKey,
          label: moduleLabel
        }) => {
          let perms = sortPermissions(groupedPermissions[moduleKey], moduleKey);

          // 根据后端配置过滤允许显示的权限
          if (selectedRole?.slug && allowedRolePermissions[selectedRole.slug]) {
            const allowed = allowedRolePermissions[selectedRole.slug];
            perms = perms.filter(p => allowed.includes(p.slug));
          }
          if (!perms || perms.length === 0) return null;
          return <div key={moduleKey} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-muted/90 backdrop-blur-sm px-4 py-2 border-y z-10 first:border-t-0">
                  <span className="font-semibold text-sm text-foreground/80">{moduleLabel}</span>
                  <Badge variant="secondary" className="text-xs">{perms.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 py-1">
                  {perms.map(perm => {
                const selected = isPermissionSelected(perm.id);
                const conditions = getPermissionConditions(perm.id);
                const hasConfig = conditions && Object.keys(conditions).length > 0;
                const conditionCount = getPermissionConditionTypes(perm.slug).length;
                return <div key={perm.id} className={cn('flex items-center gap-3 h-11 px-4 rounded-md transition-all', selected && 'bg-primary/5 text-primary', !selected && 'hover:bg-muted/60')}>
                      <Checkbox id={`perm-${perm.id}`} checked={selected} onCheckedChange={() => togglePermission(perm.id)} disabled={submitting} />
                      <Label htmlFor={`perm-${perm.id}`} className="text-sm font-medium cursor-pointer flex-1 truncate" title={`${perm.name} (${perm.slug})`}>
                        {perm.name}
                      </Label>
                      {/* 显示已配置的条件数量 */}
                      {selected && hasConfig && <Badge variant="outline" className="text-[11px] px-1.5 h-5 font-medium">
                          {Object.keys(conditions).length}
                        </Badge>}
                      {/* 条件配置按钮 */}
                      <div className="shrink-0 flex justify-center">
                        {selected && conditionCount > 0 && <ConditionEditor conditions={conditions} permission={perm} onChange={newConditions => updatePermissionConditions(perm.id, newConditions)} disabled={submitting} hasConfig={hasConfig} conditionTypes={getPermissionConditionTypes(perm.slug)} dynamicDataSources={dynamicDataSources} />}
                      </div>
                    </div>;
              })}
              </div>
            </div>;
        })}
        </div>
      </FormDialog>
    </div>;
}
