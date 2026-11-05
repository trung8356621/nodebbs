import { PROVIDER_SEPAY } from '../constants.js';

/**
 * Provider webhooks — raw body preserved for HMAC verification.
 * Responds `{ success: true }` on accepted processing (SePay contract).
 */
export default async function webhookRoutes(fastify) {
  // Scoped JSON parser: keep raw string for HMAC; also attach parsed object.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      try {
        const raw = typeof body === 'string' ? body : body.toString('utf8');
        request.rawBody = raw;
        const parsed = raw ? JSON.parse(raw) : {};
        done(null, parsed);
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  const handle = async (request, reply, providerName) => {
    try {
      const result = await fastify.bankPayment.webhooks.handleWebhook({
        providerName,
        rawBody: request.rawBody || JSON.stringify(request.body || {}),
        headers: request.headers,
        parsedBody: request.body,
      });
      return reply.code(200).send({ success: true, ...result });
    } catch (err) {
      const status = err.statusCode || 400;
      // SePay retries on non-2xx or missing success:true — forged should 401.
      return reply.code(status).send({
        success: false,
        error: err.code || 'webhook_failed',
        message: err.message,
      });
    }
  };

  fastify.post('/webhooks/sepay', async (request, reply) => handle(request, reply, PROVIDER_SEPAY));
  fastify.post('/webhooks/:provider', async (request, reply) => {
    return handle(request, reply, String(request.params.provider || '').toLowerCase());
  });
}
