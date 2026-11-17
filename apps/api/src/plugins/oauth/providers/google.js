/**
 * Google OAuth 提供商
 */
import jwt from 'jsonwebtoken';
import { BaseOAuthProvider } from './base.js';
import { normalizeOAuthProfile } from './normalize.js';
import { OAuthError, OAuthErrorCode } from '../errors.js';

/**
 * @param {object} tokenErrorBody
 * @param {string | null | undefined} callbackUrl
 */
function throwGoogleTokenError(tokenErrorBody, callbackUrl) {
  const error = tokenErrorBody?.error || '';
  const description = tokenErrorBody?.error_description || '';
  const combined = `${error} ${description}`.toLowerCase();

  if (
    error === 'redirect_uri_mismatch' ||
    combined.includes('redirect_uri_mismatch') ||
    combined.includes('redirect uri mismatch')
  ) {
    throw new OAuthError(
      OAuthErrorCode.REDIRECT_URI_MISMATCH,
      'redirect_uri_mismatch: Google 拒绝了回调地址。请将 Admin 显示的 Callback URL 原样粘贴到 Google Cloud → Authorized redirect URIs，并确认与当前 public origin 一致。',
      { callbackUrl: callbackUrl || null, googleError: error, googleDescription: description },
    );
  }

  throw new OAuthError(
    OAuthErrorCode.TOKEN_EXCHANGE_FAILED,
    description || error || '代码换取 Token 失败',
    { googleError: error || null, googleDescription: description || null },
  );
}

export class GoogleProvider extends BaseOAuthProvider {
  constructor() {
    super();
    this.name = 'google';
  }

  validateConfig(config) {
    const base = super.validateConfig(config);
    if (!base.valid) return base;
    if (!config.callbackUrl) {
      return {
        valid: false,
        message:
          '缺少 Callback URL：请配置 FORUM_PUBLIC_ORIGIN / FORUM_WEB_ORIGIN 或后台 Site URL',
      };
    }
    return { valid: true };
  }

  async getAuthorizationUrl(config, state) {
    if (!config.callbackUrl) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_CONFIG,
        '缺少 Callback URL：请配置 FORUM_PUBLIC_ORIGIN / FORUM_WEB_ORIGIN 或后台 Site URL',
      );
    }

    const scope = this.parseScope(config.scope, ['openid', 'profile', 'email']);

    const redirectUri = String(config.callbackUrl || '').trim();
    if (!redirectUri) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_CONFIG,
        '缺少 Callback URL：请配置 FORUM_PUBLIC_ORIGIN / FORUM_WEB_ORIGIN 或后台 Site URL',
      );
    }

    const params = new URLSearchParams();
    params.set('client_id', config.clientId);
    params.set('redirect_uri', redirectUri);
    params.set('scope', scope.join(' '));
    params.set('state', state);
    params.set('response_type', 'code');
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');

    // Hard guard: never send Google an auth URL with blank redirect_uri.
    if (!params.get('redirect_uri')) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_CONFIG,
        '缺少 Callback URL：无法构造 Google 授权链接',
      );
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(config, code) {
    if (!config.callbackUrl) {
      throw new OAuthError(
        OAuthErrorCode.INVALID_CONFIG,
        '缺少 Callback URL：请配置 FORUM_PUBLIC_ORIGIN / FORUM_WEB_ORIGIN 或后台 Site URL',
      );
    }

    // 用 code 换取 access_token
    const tokenResponse = await this.fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.callbackUrl,
          grant_type: 'authorization_code',
        }),
      }
    );

    let token;
    try {
      token = await tokenResponse.json();
    } catch {
      token = null;
    }

    if (!tokenResponse.ok) {
      throwGoogleTokenError(token || {}, config.callbackUrl);
    }

    if (token?.error) {
      throwGoogleTokenError(token, config.callbackUrl);
    }

    // 从 id_token 解析用户信息
    const idToken = token.id_token;
    if (!idToken) {
      throw new Error('未收到 id_token');
    }

    // id_token 从 Google 令牌端点直接获取（服务端到服务端 HTTPS），解码后验证关键字段
    const googleUser = jwt.decode(idToken);
    if (!googleUser) {
      throw new Error('解码 id_token 失败');
    }

    // 验证签发者
    if (googleUser.iss !== 'https://accounts.google.com' && googleUser.iss !== 'accounts.google.com') {
      throw new Error('id_token 签发者无效');
    }

    // 验证受众
    if (googleUser.aud !== config.clientId) {
      throw new Error('id_token 受众无效');
    }

    // 验证过期时间
    const now = Math.floor(Date.now() / 1000);
    if (googleUser.exp < now) {
      throw new Error('id_token 已过期');
    }

    return {
      profile: normalizeOAuthProfile('google', {
        id: googleUser.sub,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name,
        picture: googleUser.picture,
      }),
      providerAccountId: googleUser.sub,
      tokenData: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_in
          ? new Date(Date.now() + token.expires_in * 1000)
          : null,
        tokenType: token.token_type,
        scope: token.scope,
        idToken: token.id_token,
      },
    };
  }
}
