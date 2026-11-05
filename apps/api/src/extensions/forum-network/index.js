import fp from 'fastify-plugin';
import { ForumNetworkService } from './services/networkService.js';
import adminRoutes from './routes/admin.js';

/**
 * Parent/Child forum network addon.
 * - Role is settings-driven (any forum may enable Parent).
 * - Child never requires Parent or OPS at runtime.
 * - Schema may be absent on legacy Forum A/B; plugin degrades gracefully.
 */
async function forumNetworkPlugin(fastify) {
  const service = new ForumNetworkService(fastify);
  const ready = await service.ensureReady().catch((err) => {
    fastify.log.warn({ err: err.message }, '[forum-network] schema probe failed');
    return false;
  });

  fastify.decorate('forumNetwork', service);

  // Always mount admin routes. Missing schema must surface as 503 schema_missing
  // (via requireReady), not Fastify 404 "route not found".
  await fastify.register(adminRoutes, { prefix: '/api/forum/network' });
  if (ready) {
    fastify.log.info('[forum-network] extension registered (Parent/Child; OPS optional stub only)');
  } else {
    fastify.log.info('[forum-network] routes mounted; schema missing until baseline/0012 applied');
  }
}

export default fp(forumNetworkPlugin, {
  name: 'forum-network',
  dependencies: ['db'],
});
