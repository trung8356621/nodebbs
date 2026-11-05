import { resolvePaymentConfig } from '../config.js';

/**
 * User-facing top-up APIs. Public checkout gated by feature flag (default OFF).
 */
export default async function userRoutes(fastify) {
  const requireUser = [fastify.authenticate];

  fastify.get('/packages', { preHandler: requireUser }, async (request, reply) => {
    const cfg = await resolvePaymentConfig(fastify);
    if (!cfg.enabled && !cfg.fixtureMode) {
      return reply.code(403).send({ error: 'payment_disabled', message: 'Bank transfer payment is disabled' });
    }
    const packages = await fastify.bankPayment.orders.listPackages();
    return {
      data: {
        packages,
        publicCheckout: cfg.publicCheckout,
        provider: cfg.provider,
        sandbox: cfg.sandbox,
      },
    };
  });

  fastify.get('/status', { preHandler: requireUser }, async () => {
    const cfg = await resolvePaymentConfig(fastify);
    return {
      data: {
        enabled: cfg.enabled,
        publicCheckout: cfg.publicCheckout,
        provider: cfg.provider,
        sandbox: cfg.sandbox,
        mayGrantCredits: cfg.mayGrantCredits,
      },
    };
  });

  fastify.post('/orders', { preHandler: requireUser }, async (request, reply) => {
    try {
      const body = request.body || {};
      const order = await fastify.bankPayment.orders.createOrder({
        userId: request.user.id,
        packageCode: body.packageCode,
        amountVnd: body.amountVnd,
        idempotencyKey: body.idempotencyKey || request.headers['idempotency-key'],
        metadata: body.metadata,
      });
      return reply.code(201).send({ data: order });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({
        error: err.code || 'order_failed',
        message: err.message,
      });
    }
  });

  fastify.get('/orders/:orderId', { preHandler: requireUser }, async (request, reply) => {
    try {
      const order = await fastify.bankPayment.orders.getOrder(request.params.orderId, {
        userId: request.user.id,
      });
      return { data: order };
    } catch (err) {
      return reply.code(err.statusCode || 400).send({
        error: err.code || 'order_failed',
        message: err.message,
      });
    }
  });
}
