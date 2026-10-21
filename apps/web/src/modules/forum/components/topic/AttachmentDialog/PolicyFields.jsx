'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/common/MultiSelect';
import { ATTACHMENT_POLICIES } from '@/utils/attachment';

/**
 * 下载策略选择器 + 各策略的附加字段。
 * 由 UploadTab 在「新建」与「编辑草稿」两种场景复用。
 *
 * @param {object} props
 * @param {{policy:string, pointsCost:number, allowedRoleIds:number[]}} props.value
 * @param {(next:object)=>void} props.onChange - 传入完整的下一个 value
 * @param {boolean} [props.disabled]
 */
export default function PolicyFields({
  value,
  onChange,
  disabled
}) {
  const pbnT = usePbnTranslations();
  const [roleOptions, setRoleOptions] = useState([]);
  const [rolesError, setRolesError] = useState(null);
  const activePolicy = ATTACHMENT_POLICIES(pbnT).find(p => p.value === value.policy);

  // 仅在真正选到「限定角色」时才拉角色列表，避免每次开弹窗都打一次接口
  useEffect(() => {
    if (value.policy !== 'role' || roleOptions.length > 0) return;
    let cancelled = false;
    fetch('/api/roles/options').then(async res => {
      if (!res.ok) throw new Error(pbnT("m2214"));
      return res.json();
    }).then(list => {
      if (cancelled) return;
      setRoleOptions(list.map(r => ({
        value: r.id,
        label: r.name
      })));
    }).catch(err => !cancelled && setRolesError(err.message));
    return () => {
      cancelled = true;
    };
  }, [value.policy, roleOptions.length]);
  return <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">{pbnT("m2215")}</Label>
        <Select value={value.policy} onValueChange={policy => onChange({
        ...value,
        policy
      })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTACHMENT_POLICIES(pbnT).map(p => <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>)}
          </SelectContent>
        </Select>
        {activePolicy && <p className="text-xs text-muted-foreground">{activePolicy.description}</p>}
      </div>

      {value.policy === 'points' && <div className="space-y-1.5">
          <Label className="text-sm">{pbnT("m2216")}</Label>
          <Input type="number" min="1" value={value.pointsCost || ''} onChange={e => onChange({
        ...value,
        pointsCost: e.target.value ? parseInt(e.target.value, 10) : 0
      })} placeholder={pbnT("m2217")} disabled={disabled} />
        </div>}

      {value.policy === 'role' && <div className="space-y-1.5">
          <Label className="text-sm">{pbnT("m2218")}</Label>
          <MultiSelect value={value.allowedRoleIds || []} onChange={allowedRoleIds => onChange({
        ...value,
        allowedRoleIds
      })} options={roleOptions} placeholder={pbnT("m859")} disabled={disabled} />
          {rolesError && <p className="text-xs text-destructive">{rolesError}</p>}
        </div>}

      <p className="text-xs text-muted-foreground">{pbnT("m2219")}</p>
    </div>;
}
