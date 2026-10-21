'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Label } from '@/components/ui/label';
import { MultiRoleSelect } from './MultiRoleSelect';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
function buildUserRoles(roleIds, availableRoles) {
  return roleIds.map(id => {
    const role = availableRoles.find(r => r.id === id);
    return role ? {
      id: role.id,
      slug: role.slug,
      name: role.name,
      color: role.color,
      icon: role.icon,
      priority: role.priority
    } : null;
  }).filter(Boolean).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
export function RoleEditDialog({
  open,
  onOpenChange,
  user,
  availableRoles = [],
  onUpdated
}) {
  const pbnT = usePbnTranslations();
  // 组件挂载时直接初始化（因为使用条件渲染，每次打开都是新实例）
  const [selectedRoleIds, setSelectedRoleIds] = useState(() => user?.userRoles?.map(r => r.id) || []);
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await userApi.updateUserRoles(user.id, selectedRoleIds);
      const roleNames = selectedRoleIds.map(id => availableRoles.find(r => r.id === id)?.name).filter(Boolean).join(', ');
      toast.success(pbnT("m861", {
        arg0: user.username,
        arg1: roleNames || pbnT("m862")
      }));
      onUpdated?.(user.id, buildUserRoles(selectedRoleIds, availableRoles));
      onOpenChange(false);
    } catch (err) {
      console.error("Could not change roles:", err);
      toast.error(err.message || pbnT("m864"));
    } finally {
      setSubmitting(false);
    }
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={pbnT("m865")} description={<>{pbnT("m866")}{user?.username}{pbnT("m867")}{user?.userRoles?.some(r => r.slug === 'admin') && <>
              <br />
              <span className="text-amber-600 font-medium">{pbnT("m868")}</span>
            </>}
        </>} submitText={pbnT("m869")} onSubmit={handleSubmit} loading={submitting}>
      <div className="py-4">
        <Label className="mb-2 block">{pbnT("m342")}</Label>
        <MultiRoleSelect value={selectedRoleIds} onChange={setSelectedRoleIds} disabled={submitting} placeholder={pbnT("m870")} roles={availableRoles} />
        <p className="text-xs text-muted-foreground mt-2">{pbnT("m871")}</p>
      </div>
    </FormDialog>;
}
