import { usePbnTranslations } from "@/i18n/useTranslations";
import { OAuthButton } from './OAuthButton';
export function OAuthSection({
  providers,
  isLogin,
  isLoading,
  setIsLoading,
  setError
}) {
  const pbnT = usePbnTranslations();
  // 登录入口只展示已启用的提供商，与调用者身份无关。
  // 即便接口返回了未启用项（如管理员上下文），这里也兜底过滤掉，
  // 避免出现“未配置任何三方登录却显示全部按钮”的情况。
  const enabledProviders = (providers ?? []).filter(provider => provider.isEnabled);
  if (enabledProviders.length === 0) {
    return null;
  }
  return <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{pbnT("m1235")}{" "}{isLogin ? pbnT("m4") : pbnT("m8")}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {enabledProviders.map(provider => <OAuthButton key={provider.provider} provider={provider} isLogin={isLogin} isLoading={isLoading} setIsLoading={setIsLoading} setError={setError} />)}
      </div>
    </>;
}
