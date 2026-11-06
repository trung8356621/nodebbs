/**
 * 环境变量配置中心
 * 集中管理和校验所有环境变量
 */

import { assertRuntimeSecrets } from './runtime-secrets.js';

// 简单的环境变量获取与校验
const getEnv = (key, defaultValue) => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      // 关键变量缺失时给出警告或抛错（视策略而定，这里选择抛错以确保基础设施就绪）
      // 对于可选变量，调用时应显式传入 null 或默认值
      return undefined;
    }
    return defaultValue;
  }
  return value;
};

const getRequiredEnv = (key) => {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
};

const getBooleanEnv = (key, defaultValue) => {
  const value = getEnv(key, defaultValue);
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
};

const getOptionalBooleanEnv = (key) => {
  const value = getEnv(key);
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
};

const nodeEnv = getEnv('NODE_ENV', 'production');
const authSecrets = assertRuntimeSecrets({
  nodeEnv,
  jwtSecret: getEnv('JWT_SECRET') || '',
  cookieSecret: getEnv('COOKIE_SECRET') || '',
});

const env = {
  // 环境信息
  nodeEnv,
  isDev: nodeEnv === 'development',
  isProd: nodeEnv === 'production',

  // 服务器配置
  app: {
    port: parseInt(getEnv('PORT', '7100'), 10),
    host: getEnv('HOST', '0.0.0.0'),
  },

  // 数据库
  db: {
    url: getRequiredEnv('DATABASE_URL'),
  },

  // Redis
  redis: {
    url: getEnv('REDIS_URL'), // Redis 可能是可选的
  },

  // 安全与认证
  security: {
    jwtSecret: authSecrets.jwtSecret,
    jwtExpiresIn: getEnv('JWT_ACCESS_TOKEN_EXPIRES_IN', '7d'),

    cookieSecret: authSecrets.cookieSecret,
    cookieSecure: getOptionalBooleanEnv('COOKIE_SECURE'),
    cookieSameSite: getEnv('COOKIE_SAMESITE', 'lax'),
    cookieDomain: getEnv('COOKIE_DOMAIN'), // undefined 表示当前域

    corsOrigin: getEnv('CORS_ORIGIN'),
  },

  // 缓存配置
  cache: {
    userTtl: parseInt(getEnv('USER_CACHE_TTL', '120'), 10),
  },
};

export default env;

export const { isDev, isProd } = env;
