import { usePbnTranslations } from "@/i18n/useTranslations";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
function Spinner({
  className,
  ...props
}) {
  const pbnT = usePbnTranslations();
  return <Loader2Icon role="status" aria-label={pbnT("e7")} className={cn("size-4 animate-spin", className)} {...props} />;
}
export { Spinner };
