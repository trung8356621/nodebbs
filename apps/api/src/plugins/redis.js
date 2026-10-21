import fp from 'fastify-plugin'
import fastifyRedis from '@fastify/redis'
import env from '../config/env.js'

/**
 * Redis 缓存插件
 * 提供 Redis 连接和缓存工具方法
 */
async function redisPlugin(fastify, options) {
  fastify.register(fastifyRedis, {
    url: env.redis.url,
    keyPrefix: process.env.REDIS_KEY_PREFIX || '',
    // 可选：配置 ioredis 原生选项
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
  })

  // 可选：在 ready 阶段进行连接测试
  fastify.addHook('onReady', async () => {
    try {
      await fastify.redis.ping()
      fastify.log.info('✅ Redis 连接成功')
    } catch (error) {
      fastify.log.error(error, '❌ Redis connection failed')
    }
  })
  // 封装缓存工具对象
  fastify.decorate('cache', {
    remember: async (key, ttl, getter) => {
      // 如果 Redis 未开启，直接执行 getter
      if (!fastify.redis) {
        return await getter()
      }

      try {
        // 尝试获取缓存
        const cached = await fastify.redis.get(key)
        if (cached) {
          return JSON.parse(cached)
        }
      } catch (error) {
        fastify.log.warn(`Redis get error for key ${key}: ${error.message}`)
      }

      // 执行获取数据逻辑
      const result = await getter()

      try {
        // 存入缓存 (仅当结果不为 undefined/null 时)
        if (result !== undefined && result !== null) {
          await fastify.redis.setex(key, ttl, JSON.stringify(result))
        }
      } catch (error) {
        fastify.log.warn(`Redis set error for key ${key}: ${error.message}`)
      }

      return result
    },

    invalidate: async (keys) => {
      if (!fastify.redis) return

      try {
        const keysArray = Array.isArray(keys) ? keys : [keys]
        if (keysArray.length > 0) {
          await fastify.redis.del(...keysArray)
        }
      } catch (error) {
        fastify.log.warn(`Redis invalidate error: ${error.message}`)
      }
    }
  })
}

export default fp(redisPlugin, {
  name: 'redis',
  dependencies: [],
})
