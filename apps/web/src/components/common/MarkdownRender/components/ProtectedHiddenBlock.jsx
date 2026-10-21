import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { Lock } from 'lucide-react';
const TYPE_LABELS = (pbnT = pbnRuntimeT) => ({
  reply: pbnT("m1424")
});
export default function ProtectedHiddenBlock({
  type
}) {
  const pbnT = usePbnTranslations();
  const label = TYPE_LABELS(pbnT)[type] || pbnT("m1425");
  return <div className="not-prose my-4 flex items-center gap-3 p-4 border border-dashed border-border rounded-lg bg-muted/30 text-muted-foreground">
      <Lock className="h-5 w-5 shrink-0" />
      <span className="text-sm">{label}</span>
    </div>;
}
