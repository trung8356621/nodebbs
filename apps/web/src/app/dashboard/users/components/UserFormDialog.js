'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
const INITIAL_FORM = {
  username: '',
  email: '',
  password: '',
  name: '',
  roleIds: [],
  isEmailVerified: false
};
export function UserFormDialog({
  open,
  onOpenChange,
  mode = 'create',
  user = null,
  availableRoles = [],
  onCreated,
  onUpdated
}) {
  const pbnT = usePbnTranslations();
  const isCreate = mode === 'create';
  // 组件挂载时直接初始化表单（因为使用条件渲染，每次打开都是新实例）
  const [form, setForm] = useState(() => isCreate ? INITIAL_FORM : {
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    name: user?.name || '',
    roleIds: user?.userRoles?.map(r => r.id) || [],
    isEmailVerified: user?.isEmailVerified || false
  });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!form.username || !form.email) {
      toast.error(pbnT("m491"));
      return;
    }
    if (isCreate && !form.password) {
      toast.error(pbnT("m872"));
      return;
    }
    if (isCreate && form.password.length < 6) {
      toast.error(pbnT("m873"));
      return;
    }
    setSubmitting(true);
    try {
      if (isCreate) {
        const {
          roleIds,
          ...createData
        } = form;
        const newUser = await userApi.createUser(createData);
        if (roleIds.length > 0) {
          await userApi.updateUserRoles(newUser.id, roleIds);
        }
        toast.success(pbnT("m874", {
          arg0: form.username
        }));
        onCreated?.();
      } else {
        const {
          password,
          roleIds,
          ...updateData
        } = form;
        await userApi.updateUser(user.id, updateData);
        await userApi.updateUserRoles(user.id, roleIds);
        toast.success(pbnT("m875", {
          arg0: form.username
        }));
        onUpdated?.(user.id, updateData, buildUserRoles(roleIds, availableRoles));
      }
      onOpenChange(false);
    } catch (err) {
      console.error(`Could not ${isCreate ? "Create" : "Update"} user:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setSubmitting(false);
    }
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={isCreate ? pbnT("m878") : pbnT("m879")} description={isCreate ? pbnT("m880") : pbnT("m881")} submitText={isCreate ? pbnT("m882") : pbnT("m114")} onSubmit={handleSubmit} loading={submitting} maxWidth="sm:max-w-125">
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="username">{pbnT("m883")}<span className="text-destructive">*</span>
          </Label>
          <Input id="username" placeholder={pbnT("m884")} value={form.username} onChange={e => setForm({
          ...form,
          username: e.target.value
        })} disabled={submitting} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{pbnT("m885")}<span className="text-destructive">*</span>
          </Label>
          <Input id="email" type="email" placeholder={pbnT("m886")} value={form.email} onChange={e => setForm({
          ...form,
          email: e.target.value
        })} disabled={submitting} />
        </div>
        {isCreate && <div className="space-y-2">
            <Label htmlFor="password">{pbnT("m887")}<span className="text-destructive">*</span>
            </Label>
            <Input id="password" type="password" placeholder={pbnT("m888")} value={form.password} onChange={e => setForm({
          ...form,
          password: e.target.value
        })} disabled={submitting} />
          </div>}
        <div className="space-y-2">
          <Label htmlFor="name">{pbnT("m722")}</Label>
          <Input id="name" placeholder={pbnT("m889")} value={form.name} onChange={e => setForm({
          ...form,
          name: e.target.value
        })} disabled={submitting} />
        </div>
        <div className="space-y-2">
          <Label>{pbnT("m341")}</Label>
          <MultiRoleSelect value={form.roleIds} onChange={roleIds => setForm({
          ...form,
          roleIds
        })} disabled={submitting} placeholder={pbnT("m890")} roles={availableRoles} />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="isEmailVerified" checked={form.isEmailVerified} onCheckedChange={checked => setForm({
          ...form,
          isEmailVerified: checked
        })} disabled={submitting} />
          <Label htmlFor="isEmailVerified" className="text-sm font-normal cursor-pointer">{pbnT("m891")}</Label>
        </div>
      </div>
    </FormDialog>;
}
