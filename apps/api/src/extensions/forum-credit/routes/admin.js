import { OPS_DEFAULT_BASE_URL } from '../constants.js';

/**
 * Admin APIs for OPS Forum connection.
 * Prefix: /api/ops/forum
 * Never returns plaintext machine credentials.
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
    const status = await fastify.forumCredit.enrollment.refreshStatus();
    const sync = await fastify.forumCredit.ledgerSync.getSyncStats();
    return { data: { ...status, ledgerSync: sync } };
  });

  fastify.post('/enroll', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const {
        enrollmentToken,
        connectionUrl,
        opsBaseUrl,
        clientVersion,
      } = request.body || {};
      const view = await fastify.forumCredit.enrollment.enroll({
        enrollmentToken,
        connectionUrl,
        opsBaseUrl: opsBaseUrl || process.env.OPS_FORUM_BASE_URL || OPS_DEFAULT_BASE_URL,
        clientVersion,
      });
      // Never include credential in response.
      return { data: view };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/verify', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const view = await fastify.forumCredit.enrollment.verify();
      return { data: view };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/connection-url', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { connectionUrl } = request.body || {};
      await fastify.forumCredit.connectionStore.updateConnectionUrl(connectionUrl || null);
      return { data: await fastify.forumCredit.connectionStore.getPublicStatus() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  /**
   * Apply credential rotation issued by OPS admin.
   * Body: { rotationId, credential, credentialVersion }
   * Credential is accepted server-side only and never echoed back.
   */
  fastify.post('/rotation/apply', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { rotationId, credential, credentialVersion } = request.body || {};
      const view = await fastify.forumCredit.enrollment.applyRotation({
        rotationId,
        credential,
        credentialVersion,
      });
      return { data: view };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/credit-orders/free', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const {
        localUserId,
        creditsToGrant,
        packageId,
        packageCode,
        pricingVersion,
        orderReference,
        idempotencyKey,
        metadata,
      } = request.body || {};
      const order = await fastify.forumCredit.orders.createFreeGrantOrder({
        localUserId,
        creditsToGrant: creditsToGrant == null ? undefined : Number(creditsToGrant),
        packageId,
        packageCode,
        pricingVersion: pricingVersion == null ? undefined : Number(pricingVersion),
        orderReference,
        idempotencyKey,
        metadata,
      });
      return { data: order };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  /** Create order from authenticated OPS credit package (forum-pricing/1 packageCode). */
  fastify.post('/credit-orders/package', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const {
        localUserId,
        packageId,
        packageCode,
        pricingVersion,
        quoteId,
        orderReference,
        idempotencyKey,
        metadata,
      } = request.body || {};
      const order = await fastify.forumCredit.orders.createPackageOrder({
        localUserId,
        packageId,
        packageCode,
        pricingVersion: pricingVersion == null ? undefined : Number(pricingVersion),
        quoteId,
        orderReference,
        idempotencyKey,
        metadata,
      });
      return { data: order };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/credit-orders', { preHandler: requireAdmin }, async (request) => {
    const orders = await fastify.forumCredit.orders.listOrders({
      limit: Number(request.query?.limit) || 50,
    });
    return { data: orders };
  });

  fastify.get('/deliveries', { preHandler: requireAdmin }, async (request) => {
    const deliveries = await fastify.forumCredit.orders.listDeliveries({
      limit: Number(request.query?.limit) || 50,
    });
    return { data: deliveries };
  });

  fastify.get('/ledger-sync', { preHandler: requireAdmin }, async (request) => {
    const stats = await fastify.forumCredit.ledgerSync.getSyncStats();
    const items = await fastify.forumCredit.ledgerSync.listOutbox({
      limit: Number(request.query?.limit) || 50,
      status: request.query?.status,
    });
    return { data: { stats, items } };
  });

  fastify.post('/ledger-sync/retry', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const result = await fastify.forumCredit.ledgerSync.processDue({
        limit: Number(request.body?.limit) || 50,
      });
      return { data: result };
    } catch (err) {
      return mapError(err, reply);
    }
  });
}
