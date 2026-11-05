import {
  listIntegrations,
  createIntegration,
  updateIntegration,
  revokeIntegration,
  searchEligibleAuthors,
} from '../services/adminService.js';

/**
 * Admin management for ingest integrations.
 * Secrets are never listed; plaintext token only on create.
 */
export default async function adminIngestRoutes(fastify) {
  const adminAuth = {
    preHandler: [
      fastify.forumIngestRequireReady,
      fastify.requirePermission('dashboard.settings'),
    ],
  };

  fastify.get(
    '/',
    {
      ...adminAuth,
      schema: {
        tags: ['integrations', 'admin'],
        description: 'List forum ingest integrations (no secrets)',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => ({ items: await listIntegrations() }),
  );

  fastify.get(
    '/authors',
    {
      ...adminAuth,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['integrations', 'admin'],
        description: 'Search eligible ingest authors (non-admin, topic.create)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 0, maxLength: 100 },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 10 },
          },
        },
      },
    },
    async (request) => searchEligibleAuthors(fastify, request.query.q || '', {
      limit: request.query.limit,
    }),
  );

  fastify.post(
    '/',
    {
      ...adminAuth,
      schema: {
        tags: ['integrations', 'admin'],
        description: 'Create ingest integration; returns plaintext token once',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'authorUserId'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120 },
            authorUserId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return await createIntegration(fastify, {
          name: request.body.name,
          authorUserId: request.body.authorUserId,
          createdByUserId: request.user.id,
        });
      } catch (error) {
        if (error.statusCode && error.body) {
          return reply.code(error.statusCode).send(error.body);
        }
        throw error;
      }
    },
  );

  fastify.patch(
    '/:id',
    {
      ...adminAuth,
      schema: {
        tags: ['integrations', 'admin'],
        description: 'Update ingest integration name or author',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120 },
            authorUserId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return await updateIntegration(fastify, request.params.id, request.body);
      } catch (error) {
        if (error.statusCode && error.body) {
          return reply.code(error.statusCode).send(error.body);
        }
        throw error;
      }
    },
  );

  fastify.post(
    '/:id/revoke',
    {
      ...adminAuth,
      schema: {
        tags: ['integrations', 'admin'],
        description: 'Revoke ingest integration key',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer' } },
        },
      },
    },
    async (request, reply) => {
      try {
        return await revokeIntegration(request.params.id);
      } catch (error) {
        if (error.statusCode && error.body) {
          return reply.code(error.statusCode).send(error.body);
        }
        throw error;
      }
    },
  );
}
