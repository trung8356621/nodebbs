'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loading } from '@/components/common/Loading';
import { getProviderName } from '@/components/auth/OAuthProviderIcon';

/**
 * OAuth 回调页面（动态路由）
 * 支持 GitHub、Google、Apple 等提供商
 *
 * 同时承载「登录」与「关联账号」两种流程：三方平台后台只允许注册一个回调地址，
 * 因此两者共用本页，靠后端下发的 state 前缀区分（见 oauthService.generateLinkState）。
 *
 * After a verified cookie session, use a hard navigation (location.replace) — not
 * router.push. Soft nav here races Sonner toasts + @bprogress DOM updates and
 * surfaces `Cannot read properties of null (reading 'removeChild')`, leaving the
 * UI stuck on this page. F5 on /auth/.../callback?code= also replays a spent
 * OAuth code; leaving this URL via hard redirect avoids that.
 */
export default function OAuthCallback() {
  const pbnT = usePbnTranslations();
  const searchParams = useSearchParams();
  const params = useParams();
  const {
    setAuthData,
    refreshUser
  } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [isLink, setIsLink] = useState(false);
  const provider = params.provider; // 从 URL 路径获取 provider
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const token = searchParams.get('token'); // Apple 后端直连返回的 token

      // 关联流程：失败也要回设置页，而不是把用户丢回首页
      const isLinkFlow = isLinkState(state);
      const backPath = isLinkFlow ? '/profile/settings' : '/';
      setIsLink(isLinkFlow);

      // 验证 provider
      const validProviders = ['github', 'google', 'apple', 'wechat_open', 'wechat_mp'];
      if (!validProviders.includes(provider)) {
        console.error('Invalid provider:', provider);
        setStatus('error');
        setErrorMessage(pbnT("m11", {
          arg0: provider
        }));
        toast.error(pbnT("m11", {
          arg0: provider
        }));
        scheduleHardRedirect(backPath, 2000);
        return;
      }

      // 处理错误
      if (error) {
        console.error(`${provider} OAuth error:`, error);
        setStatus('error');
        const errorMsg = getErrorMessage(error, provider, isLinkFlow, pbnT);
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        scheduleHardRedirect(backPath, 2000);
        return;
      }

      // 关联账号流程：绑定到当前登录用户，不签发新 token、不切换身份
      if (isLinkFlow) {
        if (!code) {
          setStatus('error');
          setErrorMessage(pbnT("m12"));
          scheduleHardRedirect(backPath, 2000);
          return;
        }
        try {
          setStatus('processing');
          const result = await authApi.linkOAuthCallback(provider, code, state);
          setStatus('success');
          toast.success(result.message || pbnT("m13"));
          await refreshUser();
          scheduleHardRedirect(backPath, 500);
        } catch (err) {
          console.error(`${provider} link error:`, err);
          setStatus('error');
          const errorMsg = err.message || pbnT("m14", {
            arg0: getProviderName(provider, pbnT)
          });
          setErrorMessage(errorMsg);
          toast.error(errorMsg);
          scheduleHardRedirect(backPath, 3000);
        }
        return;
      }

      // 1. 如果有 token (Apple 直连模式)，尝试恢复会话
      if (token && provider === 'apple') {
        try {
          setStatus('processing');
          const user = await refreshUser();
          if (user) {
            setAuthData(user);
            setStatus('success');
            toast.success(pbnT("m15", {
              arg0: user.name || user.username
            }));
            scheduleHardRedirect('/', 500);
            return;
          }
          throw new Error(pbnT("m16"));
        } catch (e) {
          console.error('Apple login verify failed', e);
          setErrorMessage(pbnT("m17"));
          setStatus('error');
          scheduleHardRedirect('/', 3000);
          return;
        }
      }

      // 没有 code 且没有 token，重定向到首页
      if (!code && !token) {
        console.error('Missing code or token');
        setStatus('error');
        setErrorMessage(pbnT("m18"));
        scheduleHardRedirect('/', 1000);
        return;
      }
      try {
        setStatus('processing');

        // 根据不同的提供商调用对应的回调 API
        let result;
        switch (provider) {
          case 'github':
            result = await authApi.githubCallback(code, state);
            break;
          case 'google':
            result = await authApi.googleCallback(code, state);
            break;
          case 'apple':
            result = await authApi.appleCallback(code, state);
            break;
          case 'wechat_open':
            result = await authApi.wechatOpenCallback(code, state);
            break;
          case 'wechat_mp':
            result = await authApi.wechatMpCallback(code, state);
            break;
          default:
            throw new Error(pbnT("m19", {
              arg0: provider
            }));
        }
        // Require a real cookie session (/auth/me), not just a token in the JSON body.
        if (!result?.user) {
          throw new Error(pbnT("m20"));
        }
        // Cookie is set on the callback response; refreshUser = GET /auth/me with credentials.
        let sessionUser = await refreshUser();
        if (!sessionUser) {
          await new Promise((r) => setTimeout(r, 100));
          sessionUser = await refreshUser();
        }
        if (!sessionUser) {
          throw new Error(pbnT("m16"));
        }
        setAuthData(sessionUser);
        setStatus('success');
        toast.success(pbnT("m15", {
          arg0: sessionUser.name || sessionUser.username
        }));
        // Hard redirect so home SSR reads pbn_*_auth; avoids soft-nav removeChild crash.
        scheduleHardRedirect('/', 500);
      } catch (err) {
        console.error(`${provider} callback error:`, err);
        setStatus('error');

        let errorMsg = err.message || pbnT("m21", {
          arg0: getProviderName(provider, pbnT)
        });

        if (
          err.code === 'REDIRECT_URI_MISMATCH' ||
          /redirect_uri_mismatch/i.test(errorMsg)
        ) {
          errorMsg = pbnT('oauthRedirectUriMismatch', {
            arg0: getProviderName(provider, pbnT),
          });
        } else if (errorMsg.includes(pbnT("m22"))) {
          errorMsg = pbnT("m23");
        } else if (errorMsg.includes(pbnT("m24"))) {
          errorMsg = pbnT("m25");
        }
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        scheduleHardRedirect('/', 3000);
      }
    };
    if (provider) {
      handleCallback();
    }
  }, []); // 只在组件挂载时执行一次

  return <div className='text-center space-y-4 max-w-md px-4'>
        {status === 'processing' && <Loading text={pbnT("m26", {
      arg0: isLink ? pbnT("m27") : pbnT("m28"),
      arg1: getProviderName(provider, pbnT),
      arg2: isLink ? '' : pbnT("m29")
    })} />}

        {status === 'success' && <>
            <div className='rounded-full h-12 w-12 bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto'>
              <svg className='h-6 w-6 text-green-600 dark:text-green-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
            </div>
            <p className='text-muted-foreground'>{isLink ? pbnT("m30") : pbnT("m31")}</p>
          </>}

        {status === 'error' && <>
            <div className='rounded-full h-12 w-12 bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto'>
              <svg className='h-6 w-6 text-red-600 dark:text-red-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </div>
            <p className='text-muted-foreground font-medium'>{isLink ? pbnT("m32") : pbnT("m33")}</p>
            {errorMessage && <p className='text-sm text-muted-foreground'>{errorMessage}</p>}
            <p className='text-xs text-muted-foreground'>
              {isLink ? pbnT("m34") : pbnT("m35")}
            </p>
          </>}
    </div>;
}

/**
 * Full document navigation — survives toast/progress-bar DOM races that break
 * App Router soft navigation (removeChild on null) after OAuth.
 */
function scheduleHardRedirect(path, delayMs) {
  window.setTimeout(() => {
    window.location.replace(path);
  }, delayMs);
}

/**
 * 关联流程的 state 前缀
 *
 * 与后端 oauthService.generateLinkState() 约定：关联流程的 state 为 'lk' + hex，
 * 登录流程为纯 hex（0-9a-f，绝不会以 'l' 开头），故前缀无歧义。
 * 注意这里只用于前端选择调用哪个接口，真正的安全校验在后端（独立的 state cookie）。
 */
const LINK_STATE_PREFIX = 'lk';
function isLinkState(state) {
  return typeof state === 'string' && state.startsWith(LINK_STATE_PREFIX);
}

/**
 * 获取友好的错误信息
 */
function getErrorMessage(error, provider, isLink = false, pbnT = pbnRuntimeT) {
  const providerName = getProviderName(provider, pbnT);
  const action = isLink ? pbnT("m27") : pbnT("m4");
  const errorMessages = {
    access_denied: pbnT("m36", {
      arg0: providerName
    }),
    invalid_request: pbnT("m37"),
    unauthorized_client: pbnT("m38"),
    unsupported_response_type: pbnT("m39"),
    invalid_scope: pbnT("m40"),
    server_error: pbnT("m41", {
      arg0: providerName
    }),
    temporarily_unavailable: pbnT("m42", {
      arg0: providerName
    }),
    redirect_uri_mismatch: pbnT('oauthRedirectUriMismatch', {
      arg0: providerName,
    }),
  };
  return errorMessages[error] || pbnT("m43", {
    arg0: providerName,
    arg1: action,
    arg2: error
  });
}
