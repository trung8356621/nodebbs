import fp from 'fastify-plugin';
import ingestRoutes from './routes/ingest.js';
import adminIngestRoutes from './routes/admin.js';
import {
  ensureIngestSchemaReady,
  createRequireIngestReady,
} from './services/readiness.js';

/**
 * Forum external Markdown topic ingest (machine API for SEO-OPS).
 * Reuses createTopic domain logic; does not bypass policy/moderation.
 *
 * Routes always mount. Missing schema → 503 INGEST_SCHEMA_MISSING (not 404),
 * same posture as forum-network after the schema-idle incident.
 */
async function forumIngestPlugin(fastify) {
  const readyState = await ensureIngestSchemaReady().catch((err) => {
    fastify.log.warn({ err: err.message }, '[forum-ingest] schema probe failed');
    return { ready: false, missing: 'probe_failed' };
  });

  fastify.decorate('forumIngestRequireReady', createRequireIngestReady(fastify));

  // Always register routes so clients never see Fastify "Route not found".
  await fastify.register(ingestRoutes, { prefix: '/api/integrations' });
  await fastify.register(adminIngestRoutes, { prefix: '/api/integrations/admin' });

  if (readyState.ready) {
    fastify.log.info('[forum-ingest] extension registered');
  } else {
    fastify.log.info(
      { missing: readyState.missing },
      '[forum-ingest] routes mounted; schema missing until additive push',
    );
  }
}

export default fp(forumIngestPlugin, {
  name: 'forum-ingest',
  // Keep deps minimal so a late plugin never silently prevents route mount.
  dependencies: ['db', 'auth', 'rbac', 'settings'],
});
