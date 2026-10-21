'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { moderationApi } from '@/lib/api';
import { toast } from 'sonner';
export function BanUserDialog({
  open,
  onOpenChange,
  user,
  onBanned
}) {
  const pbnT = usePbnTranslations();
  // 组件挂载时直接初始化（因为使用条件渲染，每次打开都是新实例）
  const [form, setForm] = useState({
    duration: 0,
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await moderationApi.banUser(user.id, {
        duration: form.duration || null,
        reason: form.reason || null
      });
      const durationText = form.duration ? pbnT("m839", {
        arg0: form.duration
      }) : pbnT("m840");
      toast.success(pbnT("m841", {
        arg0: user.username,
        arg1: durationText
      }));
      onBanned?.(user.id);
      onOpenChange(false);
    } catch (err) {
      console.error("Could not ban:", err);
      toast.error(err.message || pbnT("m843"));
    } finally {
      setSubmitting(false);
    }
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={pbnT("m844")} description={<>{pbnT("m845")}{user?.username}{pbnT("m846")}{user?.userRoles?.some(r => r.slug === 'admin') && <>
              <br />
              <span className="text-amber-600 font-medium">{pbnT("m847")}</span>
            </>}
        </>} submitText={pbnT("m848")} onSubmit={handleSubmit} loading={submitting} maxWidth="sm:max-w-[450px]">
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="banDuration">{pbnT("m849")}</Label>
          <Select value={form.duration?.toString() || '0'} onValueChange={value => setForm({
          ...form,
          duration: parseInt(value)
        })} disabled={submitting}>
            <SelectTrigger id="banDuration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">{pbnT("m850")}</SelectItem>
              <SelectItem value="360">{pbnT("m851")}</SelectItem>
              <SelectItem value="1440">{pbnT("m852")}</SelectItem>
              <SelectItem value="4320">{pbnT("m853")}</SelectItem>
              <SelectItem value="10080">{pbnT("m854")}</SelectItem>
              <SelectItem value="43200">{pbnT("m855")}</SelectItem>
              <SelectItem value="129600">{pbnT("m856")}</SelectItem>
              <SelectItem value="0">{pbnT("m840")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="banReason">{pbnT("m857")}</Label>
          <Textarea id="banReason" placeholder={pbnT("m858")} value={form.reason} onChange={e => setForm({
          ...form,
          reason: e.target.value
        })} disabled={submitting} rows={3} />
        </div>
      </div>
    </FormDialog>;
}
