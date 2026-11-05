import { AdminQueryService } from '../services/adminQueryService.js';

/**
 * Admin bank-payment read/config APIs for Payment UI.
 * Does not activate production. Never returns secrets.
 */
export default async function adminRoutes(fastify) {
  const requireAdmin = [fastify.requirePermission('dashboard.extensions')];
  const admin = new AdminQueryService(fastify, fastify.bankPayment.orders);

  const mapError = (err, reply) => reply.code(err.statusCode || 400).send({
    error: err.code || 'request_failed',
    message: err.message,
  });

  fastify.get('/overview', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await admin.getOverview() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/config', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await admin.getAdminConfig() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/packages', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await admin.listPackagesAdmin() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/packages', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = request.body || {};
      const row = await admin.upsertPackage({
        code: body.code,
        label: body.label,
        amountVnd: body.amountVnd,
        enabled: body.enabled,
        displayOrder: body.displayOrder,
      });
      return reply.code(201).send({ data: row });
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.patch('/packages/:code', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const row = await admin.patchPackage(request.params.code, request.body || {});
      return { data: row };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/orders', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const q = request.query || {};
      const data = await admin.listOrders({
        status: q.status,
        from: q.from,
        to: q.to,
        page: q.page,
        limit: q.limit,
      });
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/orders/:orderId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await admin.getOrderDetail(request.params.orderId) };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/reconcile/:orderId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const result = await fastify.bankPayment.webhooks.reconcileOrder(request.params.orderId);
      return { data: result };
    } catch (err) {
      return mapError(err, reply);
    }
  });
}
