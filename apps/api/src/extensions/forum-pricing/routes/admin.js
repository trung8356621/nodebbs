/**
 * Admin APIs for forum-pricing/1 sync/status.
 * Prefix: /api/ops/forum/pricing
 */
export default async function adminRoutes(fastify) {
  const requireAdmin = [fastify.requirePermission('dashboard.extensions')];

  const mapError = (err, reply) => {
    const status = err.statusCode || 400;
    return reply.code(status).send({
      error: err.code || 'request_failed',
      message: err.message,
    });
  };

  fastify.get('/status', { preHandler: requireAdmin }, async () => {
    const latest = await fastify.forumPricing.sync.getLatestVerified();
    const catalog = await fastify.forumPricing.getCatalogView();
    return {
      data: {
        hasVerifiedSnapshot: Boolean(latest),
        latestVersion: latest?.version ?? null,
        pricingVersionId: latest?.pricingVersionId ?? null,
        vndPerCredit: latest?.vndPerCredit ?? null,
        catalog,
        paidPinMigrationStatus: catalog?.paidPinMigrationStatus || 'MIGRATION_PENDING',
      },
    };
  });

  fastify.post('/sync', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const afterVersion = request.body?.afterVersion;
      const result = await fastify.forumPricing.syncFromOps({ afterVersion });
      return { data: result };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/catalog', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const catalog = await fastify.forumPricing.requireCatalogView();
      return { data: catalog };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/quotes', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = request.body || {};
      const { data } = await fastify.forumPricing.createOpsQuote({
        localUserId: body.localUserId,
        quoteKind: body.quoteKind,
        skuCode: body.skuCode,
        quantity: body.quantity,
        pricingVersion: body.pricingVersion,
        idempotencyKey: body.idempotencyKey,
      });
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });
}
