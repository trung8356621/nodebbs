import fp from 'fastify-plugin';
import { ForumPricingSyncService } from './services/syncService.js';
import adminRoutes from './routes/admin.js';

/**
 * forum-pricing/1 — OPS-owned signed catalog sync + local verified store.
 * Depends on forum-credit enrollment/opsClient.
 */
async function forumPricingPlugin(fastify) {
  const connectionStore = fastify.forumCredit.connectionStore;
  const opsClient = fastify.forumCredit.opsClient;
  const sync = new ForumPricingSyncService(fastify, connectionStore, opsClient);

  fastify.decorate('forumPricing', {
    sync,
    getCatalogView: (now) => sync.getCatalogView(now),
    requireCatalogView: (now) => sync.requireCatalogView(now),
    getPackage: (code, now) => sync.getPackage(code, now),
    getSeoProduct: (code, now) => sync.getSeoProduct(code, now),
    getPaidPin: (code, now) => sync.getPaidPin(code, now),
    ingestSnapshot: (snapshot, syncVerification) => sync.ingestSnapshot(snapshot, syncVerification),
    syncFromOps: (opts) => sync.syncFromOps(opts),
    createOpsQuote: (opts) => sync.createOpsQuote(opts),
  });

  await fastify.register(adminRoutes, { prefix: '/api/ops/forum/pricing' });

  if (fastify.cleanup?.registerTask) {
    fastify.cleanup.registerTask('forum-pricing-sync', async () => {
      try {
        await sync.syncFromOps();
      } catch (err) {
        fastify.log.warn({ err: err.message }, '[forum-pricing] sync failed; retaining last verified snapshot');
      }
    });
  }

  fastify.log.info('[forum-pricing] extension registered (forum-pricing/1)');
}

export default fp(forumPricingPlugin, {
  name: 'forum-pricing',
  dependencies: ['db', 'forum-credit'],
});
