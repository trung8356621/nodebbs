import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
export function ModeSwitcher({
  mode,
  onModeChange
}) {
  const pbnT = usePbnTranslations();
  const {
    settings,
    loading
  } = useSettings();
  if (loading) return null;
  const registrationMode = settings?.registration_mode?.value || 'open';
  const isLogin = mode === 'login';

  // 登录模式 + 注册关闭：仅显示提示
  if (isLogin && registrationMode === 'closed') {
    return <div className="text-center text-sm space-y-2 mt-2">
        <p className="text-muted-foreground text-xs">{pbnT("m7")}</p>
      </div>;
  }

  // 登录模式：显示注册入口
  if (isLogin) {
    return <div className="text-center text-sm space-y-2 mt-2">
        <Button variant="link" className="p-0 h-auto font-normal" onClick={() => onModeChange('register')}>{pbnT("m6")}</Button>
      </div>;
  }

  // 非登录模式（找回密码 / 注册关闭）：返回登录
  if (mode === 'forgot-password' || registrationMode === 'closed') {
    return <div className="text-center text-sm space-y-2 mt-2">
        <Button variant="link" className="p-0 h-auto font-normal" onClick={() => onModeChange('login')}>{pbnT("m3")}</Button>
      </div>;
  }

  // 注册模式：显示登录入口
  return <div className="text-center text-sm space-y-2 mt-2">
      <Button variant="link" className="p-0 h-auto font-normal" onClick={() => onModeChange('login')}>{pbnT("m10")}</Button>
      {registrationMode === 'invitation' && <p className="text-muted-foreground text-xs">{pbnT("m664")}</p>}
    </div>;
}
