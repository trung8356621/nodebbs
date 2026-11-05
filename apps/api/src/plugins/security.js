import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import env from '../config/env.js';
import { isOriginAllowed, parseAllowedOrigins } from '../utils/http-helpers.js';
import { resolveTrustedCorsOriginConfig } from '../utils/trusted-cors-origins.js';

async function securityPlugin(fastify, opts) {
  // Trusted origins only: CORS_ORIGIN + FORUM_PUBLIC_ORIGIN (+ FORUM_WEB_ORIGIN).
  // In development also merge ALLOWED_DEV_ORIGINS / FORUM_ALLOWED_HOSTS.
  // Never derived from request Host / X-Forwarded-*.
  const trustedCorsConfig = resolveTrustedCorsOriginConfig(process.env, { isDev: env.isDev });
  const allowedPatterns = trustedCorsConfig && trustedCorsConfig !== 'false'
    ? parseAllowedOrigins(trustedCorsConfig)
    : [];

  fastify.log.info(
    { corsOrigins: allowedPatterns.filter((p) => typeof p === 'string') },
    '[security] CORS allowlist loaded from trusted env',
  );

  // Register CORS https://github.com/fastify/fastify-cors?tab=readme-ov-file#options
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // 允许没有 Origin 头的请求（如服务器间通信、Postman）
      if (!origin) {
        cb(null, true);
        return;
      }

      if (trustedCorsConfig === 'false') {
        cb(new Error('Not allowed by CORS'), false);
        return;
      }

      if (allowedPatterns.length && isOriginAllowed(origin, allowedPatterns)) {
        cb(null, true);
        return;
      }

      // 开发环境下，自动允许 localhost 和 127.0.0.1（保持本地登录不变）
      if (env.isDev) {
        try {
          const url = new URL(origin);
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            cb(null, true);
            return;
          }
        } catch {
          cb(new Error('Not allowed by CORS'), false);
          return;
        }
      }

      // 特殊处理：允许 Apple 登录回调的 Origin
      if (origin === 'https://appleid.apple.com') {
        cb(null, true);
        return;
      }

      // 拒绝其他来源
      cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });
}

export default fp(securityPlugin, {
  name: 'security',
  dependencies: [],
});
