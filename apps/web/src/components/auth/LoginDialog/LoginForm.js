import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from './FormMessage';
import { CaptchaWidget } from '@/components/captcha/CaptchaWidget';
export function LoginForm({
  formData,
  error,
  isLoading,
  onSubmit,
  onChange,
  onForgotPassword,
  onCaptchaVerify,
  phoneLoginEnabled
}) {
  const pbnT = usePbnTranslations();
  const identifierLabel = phoneLoginEnabled ? pbnT("m1225") : pbnT("m1226");
  const identifierPlaceholder = phoneLoginEnabled ? pbnT("m1227") : pbnT("m1228");
  return <form onSubmit={onSubmit}>
      <div className="grid gap-4 py-4">
        <FormMessage error={error} />

        <div className="grid gap-2">
          <Label htmlFor="identifier">{identifierLabel}</Label>
          <Input id="identifier" name="identifier" type="text" placeholder={identifierPlaceholder} value={formData.identifier} onChange={onChange} disabled={isLoading} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">{pbnT("m1229")}</Label>
          <Input id="password" name="password" type="password" placeholder={pbnT("m1230")} value={formData.password} onChange={onChange} disabled={isLoading} required />
          <div className="flex justify-end">
            <Button type="button" variant="link" className="p-0 h-auto text-xs font-normal" onClick={onForgotPassword} disabled={isLoading} tabIndex={-1}>{pbnT("m1231")}</Button>
          </div>
        </div>

        {/* 人机验证 */}
        <CaptchaWidget scene="login" onVerify={onCaptchaVerify} />
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? pbnT("m1232") : pbnT("m4")}
        </Button>
      </div>
    </form>;
}
