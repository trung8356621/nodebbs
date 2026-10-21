import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { Eye } from 'lucide-react';
const TYPE_LABELS = (pbnT = pbnRuntimeT) => ({
  reply: pbnT("m1422")
});
export default function ProtectedContentBlock({
  type,
  children
}) {
  const pbnT = usePbnTranslations();
  const label = TYPE_LABELS(pbnT)[type] || pbnT("m1423");
  return <div className="my-4 border border-border rounded-lg overflow-hidden">
      <div className="not-prose flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-xs text-muted-foreground border-b border-border">
        <Eye className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="px-3 py-1 *:first:mt-0 *:last:mb-0">
        {children}
      </div>
    </div>;
}
