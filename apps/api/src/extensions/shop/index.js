import fp from 'fastify-plugin';
import shopRoutes from './routes/index.js';


/**
 * 商城扩展
 * 处理商城系统逻辑和路由。
 */
async function shopPlugin(fastify, options) {
  // 注册路由
  fastify.register(shopRoutes, { prefix: '/api/shop' });

  // 注册增强器


  fastify.log.info('[商城] 扩展已注册');
}

export default fp(shopPlugin, {
  name: 'shop',
  dependencies: ['ledger'],
});
