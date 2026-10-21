'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import MultiSelect from '@/components/common/MultiSelect';
export function MultiRoleSelect(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    value = [],
    onChange,
    disabled,
    placeholder = pbnT("m859"),
    roles = []
  } = pbnArgument0;
  const options = useMemo(() => roles.map(r => ({
    value: r.id,
    label: r.name,
    ...r
  })), [roles]);
  return <MultiSelect value={value} onChange={onChange} options={options} placeholder={placeholder} searchPlaceholder={pbnT("m860")} disabled={disabled} renderOption={opt => <div className="flex items-center gap-2">
          {opt.color && <span className="w-3 h-3 rounded-full" style={{
      backgroundColor: opt.color
    }} />}
          <span>{opt.name}</span>
          {opt.isSystem && <Badge variant="outline" className="text-[10px] px-1 h-4">{pbnT("m504")}</Badge>}
        </div>} />;
}
