/**
 * OAuth 2.0 插件
 * 支持 GitHub、Google、Apple、微信等提供商
 * 从数据库动态读取配置，无需重启即可生效
 */
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { oauthProviders } from '../../db/schema.js';
import { createOAuthProvider } from './providers/index.js';
import { getOAuthCallbackPath, resolveOAuthCallbackUrl } from './callbackUrl.js';

async function oauthPlugin(fastify, opts) {
  fastify.log.info('[OAuth] 正在初始化插件');

  // 缓存已实例化的 provider
  const providerInstances = new Map();

  /**
   * 获取或创建 provider 实例（lazy + 缓存）
   */
  async function getProvider(name) {
    if (providerInstances.has(name)) {
      return providerInstances.get(name);
    }
    const instance = await createOAuthProvider(name);
    providerInstances.set(name, instance);
    return instance;
  }

  /**
   * Resolve absolute callback URL from trusted public origin + deployed route.
   * @param {string} providerName
   * @param {{ storedCallbackUrl?: string | null }} [opts]
   */
  async function resolveCallbackUrl(providerName, opts = {}) {
    return resolveOAuthCallbackUrl(providerName, fastify.settings, process.env, opts);
  }

  /**
   * Persist server-derived callback URL so Admin / DB stay aligned with runtime redirect_uri.
   */
  async function persistCallbackUrl(providerName, callbackUrl) {
    if (!providerName || !callbackUrl) return;
    try {
      await db
        .update(oauthProviders)
        .set({ callbackUrl })
        .where(eq(oauthProviders.provider, providerName));
    } catch (error) {
      fastify.log.warn(error, `[OAuth] Failed to persist callback URL for ${providerName}`);
    }
  }

  /**
   * 获取提供商数据库配置，并用服务端推导的 callbackUrl 覆盖（redirect_uri 必须与 Google Console 一致）
   */
  async function getProviderConfig(providerName) {
    const [result] = await db
      .select()
      .from(oauthProviders)
      .where(eq(oauthProviders.provider, providerName))
      .limit(1);

    if (!result) return null;

    // Providers with a known deployed callback path always use the server-derived URL.
    if (getOAuthCallbackPath(providerName)) {
      const resolved = await resolveCallbackUrl(providerName, {
        storedCallbackUrl: result.callbackUrl,
      });
      const callbackUrl = resolved.resolvable ? resolved.callbackUrl : null;
      if (callbackUrl && callbackUrl !== result.callbackUrl) {
        // Best-effort self-heal; do not block login on persistence failure.
        void persistCallbackUrl(providerName, callbackUrl);
      }
      return {
        ...result,
        callbackUrl,
      };
    }

    return result;
  }

  // OAuth 服务对象
  const oauthService = {
    /**
     * 获取提供商数据库配置（含服务端推导的 callbackUrl）
     */
    getProviderConfig,

    /**
     * 解析可信的 OAuth 回调 URL
     */
    resolveCallbackUrl,

    /**
     * 持久化推导出的 callback URL
     */
    persistCallbackUrl,

    /**
     * 获取提供商实例
     */
    getProvider,

    /**
     * 清除 provider 缓存
     */
    invalidateCache(name) {
      if (name) {
        providerInstances.delete(name);
      } else {
        providerInstances.clear();
      }
    },
  };

  fastify.decorate('oauth', oauthService);

  fastify.log.info('[OAuth] 插件初始化完成');
}

export default fp(oauthPlugin, {
  name: 'oauth',
  dependencies: ['settings'],
});
