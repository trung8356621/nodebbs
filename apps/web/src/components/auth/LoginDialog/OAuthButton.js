import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { OAuthProviderIcon } from '@/components/auth/OAuthProviderIcon';
export function OAuthButton({
  provider,
  isLogin,
  isLoading,
  setIsLoading,
  setError
}) {
  const pbnT = usePbnTranslations();
  const handleOAuthLogin = async () => {
    try {
      setIsLoading(true);
      let authorizationUri;
      switch (provider.provider) {
        case 'github':
          const githubData = await authApi.getGithubAuthUrl();
          authorizationUri = githubData.authorizationUri;
          break;
        case 'google':
          const googleData = await authApi.getGoogleAuthUrl();
          authorizationUri = googleData.authorizationUri;
          break;
        case 'apple':
          const appleData = await authApi.getAppleAuthUrl();
          authorizationUri = appleData.authorizationUri;
          break;
        case 'wechat_open':
          const wechatOpenData = await authApi.getWechatOpenAuthUrl();
          authorizationUri = wechatOpenData.authorizationUri;
          break;
        case 'wechat_mp':
          const wechatMpData = await authApi.getWechatMpAuthUrl();
          authorizationUri = wechatMpData.authorizationUri;
          break;
        default:
          throw new Error(pbnT("m1233"));
      }
      window.location.href = authorizationUri;
    } catch (err) {
      setError(err.message || pbnT("m21", {
        arg0: provider.displayName
      }));
      toast.error(err.message || pbnT("m21", {
        arg0: provider.displayName
      }));
      setIsLoading(false);
    }
  };
  return <Button type="button" variant="outline" className="w-full" onClick={handleOAuthLogin} disabled={isLoading}>
      <OAuthProviderIcon provider={provider.provider} />{pbnT("m1234")}{" "}{provider.displayName} {isLogin ? pbnT("m4") : pbnT("m8")}
    </Button>;
}
