/**
 * Admin APIs for Parent/Child forum network.
 * Prefix: /api/forum/network
 * Runtime never requires Parent or OPS to serve Child traffic.
 * Child provisioning remains CLI-confirmed (no runtime DB create).
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

  fastify.get('/status', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.status() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/overview', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.overview() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/enable-parent', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.enableParent(request.user.id) };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/children', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.listChildren() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/templates', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const rows = await fastify.forumNetwork.listTemplates();
      return {
        data: {
          templates: rows.map((r) => fastify.forumNetwork.summarizeTemplate(r)),
          fieldClasses: (await fastify.forumNetwork.status()).fieldClasses,
        },
      };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/templates/:id', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
      },
    },
  }, async (request, reply) => {
    try {
      const row = await fastify.forumNetwork.getTemplate(request.params.id);
      if (!row) return reply.code(404).send({ error: 'not_found', message: 'Template not found' });
      return { data: fastify.forumNetwork.summarizeTemplate(row) };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/policies', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.listPolicyVersions() };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/policy-applications', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
      },
    },
  }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.listPolicyApplications(request.query?.limit) };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/policies', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['managed'],
        additionalProperties: false,
        properties: {
          managed: { type: 'object' },
          notes: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.forumNetwork.publishPolicy(request.body.managed, {
        notes: request.body.notes,
        version: request.body.version,
        actorId: request.user.id,
      });
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/policies/publish-from-template', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          templateId: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.forumNetwork.publishFromTemplate(
        request.body?.templateId || 'default',
        { notes: request.body?.notes, actorId: request.user.id },
      );
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/policies/apply', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['package'],
        additionalProperties: false,
        properties: {
          package: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await fastify.forumNetwork.applyPolicyPackage(request.body.package, {
        source: 'admin_api',
        actorId: request.user.id,
      });
      return { data };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.post('/children/draft', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        required: ['id', 'database', 'name'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          database: { type: 'string' },
          name: { type: 'string' },
          domain: { type: 'string' },
          publicOrigin: { type: 'string' },
          hostname: { type: 'string' },
          webPort: { type: 'integer', minimum: 1025, maximum: 65535 },
          apiPort: { type: 'integer', minimum: 1025, maximum: 65535 },
          locale: { type: 'string', enum: ['vi-VN', 'en-US'] },
          primaryColor: { type: 'string' },
          logo: { type: 'string' },
          description: { type: 'string' },
          templateId: { type: 'string' },
          freeMonths: { type: 'integer', enum: [1, 2, 3] },
          adminUsernameHint: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.draftChildConfig(request.body) };
    } catch (err) {
      return mapError(err, reply);
    }
  });

  fastify.get('/topic-refs/check', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        required: ['title'],
        properties: { title: { type: 'string', minLength: 1, maxLength: 255 } },
      },
    },
  }, async (request, reply) => {
    try {
      return { data: await fastify.forumNetwork.findReferenceCollision(request.query.title) };
    } catch (err) {
      return mapError(err, reply);
    }
  });
}
