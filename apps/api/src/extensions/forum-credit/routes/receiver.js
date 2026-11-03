import { bearerFromHeader } from '../crypto.js';

/**
 * OPS → PBN inbound routes (no /api prefix).
 * POST /ops/v1/forum/ping
 * POST /ops/v1/forum/events/credit-granted
 */
export default async function receiverRoutes(fastify) {
  const mapError = (err, reply) => {
    const status = err.statusCode || (err.code === 'unauthorized' ? 401
      : err.code === 'cross_forum_denied' ? 403
        : err.code === 'user_not_found' ? 422
          : 400);
    return reply.code(status).send({
      error: err.code || 'request_failed',
      message: err.message,
    });
  };

  const attachBearer = async (request) => {
    request.authBearer = bearerFromHeader(request.headers.authorization);
  };

  fastify.post('/ops/v1/forum/ping', { preHandler: attachBearer }, async (request, reply) => {
    try {
      const result = await fastify.forumCredit.receiver.ping(request);
      return reply.send(result);
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/ops/v1/forum/events/credit-granted', { preHandler: attachBearer }, async (request, reply) => {
    try {
      const result = await fastify.forumCredit.receiver.applyCreditGranted(request);
      // ACK contract: only { ack: true } after durable apply (incl. duplicates).
      return reply.send({ ack: true, eventId: result.eventId, duplicate: Boolean(result.duplicate) });
    } catch (err) {
      return mapError(err, reply);
    }
  });
}
