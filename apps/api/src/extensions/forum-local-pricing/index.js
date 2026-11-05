import fp from 'fastify-plugin';
import { LocalPricingService } from './services/localPricingService.js';
import adminRoutes from './routes/admin.js';

/**
 * Forum-primary commercial service pricing (local VND base + optional OPS policy).
 * Outbound Forum→OPS service sync is intentionally unsupported until OPS adds a contract.
 */
async function forumLocalPricingPlugin(fastify) {
  const service = new LocalPricingService(fastify);
  await service.ensureSeeded().catch((err) => {
    fastify.log.warn(
      { err: err.message },
      '[forum-local-pricing] seed skipped (apply baseline/0009_forum_local_pricing.sql)',
    );
  });

  fastify.decorate('localPricing', service);

  await fastify.register(adminRoutes, { prefix: '/api/forum/local-pricing' });

  fastify.log.info('[forum-local-pricing] extension registered (Forum-primary; OPS sync unsupported)');
}

export default fp(forumLocalPricingPlugin, {
  name: 'forum-local-pricing',
  dependencies: ['db'],
});
