import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from './FormMessage';
import { CaptchaWidget } from '@/components/captcha/CaptchaWidget';
export function RegisterForm({
  formData,
  error,
  isLoading,
  registrationMode,
  invitationCodeStatus,
  onSubmit,
  onChange,
  onInvitationCodeBlur,
  onCaptchaVerify
}) {
  const pbnT = usePbnTranslations();
  return <form onSubmit={onSubmit}>
      <div className="grid gap-4 py-4">
        <FormMessage error={error} />

        <div className="grid gap-2">
          <Label htmlFor="username">{pbnT("m1248")}</Label>
          <Input id="username" name="username" type="text" placeholder={pbnT("m1249")} value={formData.username} onChange={onChange} disabled={isLoading} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">{pbnT("m1250")}</Label>
          <Input id="name" name="name" type="text" placeholder={pbnT("m1251")} value={formData.name} onChange={onChange} disabled={isLoading} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">{pbnT("m1219")}</Label>
          <Input id="email" name="email" type="email" placeholder="m@example.com" value={formData.email} onChange={onChange} disabled={isLoading} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">{pbnT("m1229")}</Label>
          <Input id="password" name="password" type="password" placeholder={pbnT("m1222")} value={formData.password} onChange={onChange} disabled={isLoading} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">{pbnT("m1252")}</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" placeholder={pbnT("m1253")} value={formData.confirmPassword} onChange={onChange} disabled={isLoading} required />
        </div>

        {/* 邀请码输入框（仅在邀请码注册模式下显示） */}
        {registrationMode === 'invitation' && <div className="grid gap-2">
            <Label htmlFor="invitationCode">{pbnT("m295")}<span className="text-red-500">*</span>
            </Label>
            <Input id="invitationCode" name="invitationCode" type="text" placeholder={pbnT("m1254")} value={formData.invitationCode} onChange={onChange} onBlur={onInvitationCodeBlur} disabled={isLoading} required />
            {invitationCodeStatus && <p className={`text-sm ${invitationCodeStatus.valid ? 'text-green-600' : 'text-red-600'}`}>
                {invitationCodeStatus.message}
              </p>}
          </div>}

        {/* 人机验证 */}
        <CaptchaWidget scene="register" onVerify={onCaptchaVerify} />
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? pbnT("m1255") : pbnT("m8")}
        </Button>
      </div>
    </form>;
}
