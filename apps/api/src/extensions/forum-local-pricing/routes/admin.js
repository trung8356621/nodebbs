import { KNOWN_SERVICES, OPS_SERVICE_SYNC_STATUS } from '../constants.js';

/**
 * Admin APIs for Forum-local commercial pricing.
 * Prefix: /api/forum/local-pricing
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

  fastify.get('/services', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.localPricing.listServices() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.patch('/services/:serviceCode', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        required: ['serviceCode'],
        properties: { serviceCode: { type: 'string', enum: KNOWN_SERVICES } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          basePriceVnd: { type: 'integer', minimum: 0, maximum: 1_000_000_000 },
          enabled: { type: 'boolean' },
          options: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.localPricing.updateService(
        request.params.serviceCode,
        request.body || {},
        request.user.id,
      );
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/services/:serviceCode/history', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        required: ['serviceCode'],
        properties: { serviceCode: { type: 'string', enum: KNOWN_SERVICES } },
      },
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
      },
    },
  }, async (request, reply) => {
    try {
      const rows = await fastify.localPricing.priceHistory(
        request.params.serviceCode,
        request.query?.limit,
      );
      return { data: { serviceCode: request.params.serviceCode, history: rows } };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.patch('/settings/free-mode', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['enabled'],
        additionalProperties: false,
        properties: { enabled: { type: 'boolean' } },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.localPricing.setFreeMode(request.body.enabled, request.user.id);
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/settings/vnd-per-credit', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const vndPerCredit = await fastify.localPricing.getVndPerCredit();
      const history = await fastify.localPricing.listVndPerCreditHistory(20);
      return {
        data: {
          unit: 'VND',
          vndPerCredit,
          creditDisplay: {
            unit: 'VND',
            creditVnd: vndPerCredit,
            label: `1 Credit = ${vndPerCredit.toLocaleString('vi-VN')} VND`,
            opsReference: await fastify.localPricing.getOpsVndPerCreditReference(),
          },
          history,
        },
      };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.patch('/settings/vnd-per-credit', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['value'],
        additionalProperties: false,
        properties: {
          value: { type: 'integer', minimum: 1, maximum: 1_000_000_000 },
          note: { type: 'string', maxLength: 255 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.localPricing.setVndPerCredit(
        request.body.value,
        request.user.id,
        request.body.note,
      );
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  /**
   * Outbound sync stub — never claims success.
   * OPS counterpart has no compatible Forum-base service push contract yet.
   */
  fastify.post('/sync-to-ops', { preHandler: requireAdmin }, async (request, reply) => {
    let enrolled = false;
    try {
      const st = await fastify.forumCredit?.connectionStore?.getPublicStatus?.();
      enrolled = Boolean(st?.connected || st?.connectionStatus === 'connected' || st?.forumId);
    } catch {
      enrolled = false;
    }
    return reply.code(501).send({
      error: 'OPS_SYNC_UNSUPPORTED',
      message: OPS_SERVICE_SYNC_STATUS.reason,
      data: {
        ...OPS_SERVICE_SYNC_STATUS,
        enrolled,
        enabled: false,
        status: 'unsupported',
      },
    });
  });
}
