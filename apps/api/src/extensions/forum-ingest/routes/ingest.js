import { createAuthenticateIngest } from '../services/ingestAuth.js';
import { ingestTopic } from '../services/ingestService.js';

/**
 * Machine ingest: POST /api/integrations/topics
 * Auth: Bearer pbn_ingest_<keyId>_<secret> (not session JWT).
 */
export default async function ingestRoutes(fastify) {
  const authenticateIngest = createAuthenticateIngest(fastify);

  fastify.post(
    '/topics',
    {
      preHandler: [fastify.forumIngestRequireReady, authenticateIngest],
      schema: {
        tags: ['integrations'],
        description: 'Create a Markdown topic via machine ingest (idempotent by externalRef)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['externalRef', 'title', 'categoryId', 'content'],
          properties: {
            externalRef: { type: 'string', minLength: 1, maxLength: 191 },
            title: { type: 'string', minLength: 3, maxLength: 255 },
            categoryId: { type: 'integer', minimum: 1 },
            content: { type: 'string', minLength: 1 },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await ingestTopic(fastify, request, request.body);
        // Include topic.id so policy plugin can attach decision.contentId (same as POST /topics).
        return {
          topicId: result.topicId,
          topic: { id: result.topicId },
          canonicalUrl: result.canonicalUrl,
          approvalStatus: result.approvalStatus,
          requiresApproval: result.requiresApproval,
          idempotent: result.idempotent,
          ...(result.message ? { message: result.message } : {}),
        };
      } catch (error) {
        if (error.statusCode && error.body) {
          return reply.code(error.statusCode).send(error.body);
        }
        if (error.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: error.code || 'INGEST_ERROR',
          });
        }
        throw error;
      }
    },
  );
}
