import { eq, and } from 'drizzle-orm';
import db from '#core/db/index.js';
import { users } from '#core/db/schema.js';
import { forumIngestIntegrations } from '../schema.js';
import {
  parseIngestBearer,
  hashSecret,
  constantTimeEqual,
} from '../crypto.js';

/**
 * Authenticate machine ingest Bearer token and attach integration author as request.user.
 * Does not accept session JWT or admin password.
 */
export function createAuthenticateIngest(fastify) {
  return async function authenticateIngest(request, reply) {
    const parsed = parseIngestBearer(request.headers.authorization);
    if (!parsed) {
      return reply.code(401).send({
        error: 'Invalid or missing ingest credential',
        code: 'INGEST_AUTH_INVALID',
      });
    }

    const [integration] = await db
      .select()
      .from(forumIngestIntegrations)
      .where(eq(forumIngestIntegrations.keyId, parsed.keyId))
      .limit(1);

    if (!integration) {
      return reply.code(401).send({
        error: 'Invalid or missing ingest credential',
        code: 'INGEST_AUTH_INVALID',
      });
    }

    if (integration.status !== 'active') {
      return reply.code(401).send({
        error: 'Ingest credential has been revoked',
        code: 'INGEST_AUTH_REVOKED',
      });
    }

    const expectedForumId = process.env.FORUM_ID || null;
    if (expectedForumId && integration.forumId && integration.forumId !== expectedForumId) {
      return reply.code(401).send({
        error: 'Ingest credential is not valid for this forum',
        code: 'INGEST_AUTH_FORUM_MISMATCH',
      });
    }

    const candidateHash = hashSecret(parsed.token);
    if (!constantTimeEqual(candidateHash, integration.secretHash)) {
      return reply.code(401).send({
        error: 'Invalid or missing ingest credential',
        code: 'INGEST_AUTH_INVALID',
      });
    }

    const [author] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, integration.authorUserId), eq(users.isDeleted, false)))
      .limit(1);

    if (!author) {
      return reply.code(403).send({
        error: 'Integration author is unavailable',
        code: 'INGEST_AUTHOR_UNAVAILABLE',
      });
    }

    if (author.isBanned) {
      return reply.code(403).send({
        error: 'Integration author is banned',
        code: 'INGEST_AUTHOR_BANNED',
      });
    }

    const enriched = await fastify.permission.enrichUser(author);
    delete enriched.passwordHash;

    if (author.role === 'admin' || enriched.isAdmin) {
      return reply.code(403).send({
        error: 'Integration author must not be an admin',
        code: 'INGEST_AUTHOR_ADMIN_FORBIDDEN',
      });
    }

    const hasCreate = await fastify.permission.hasPermission(author.id, 'topic.create');
    if (!hasCreate) {
      return reply.code(403).send({
        error: 'Integration author lacks topic.create permission',
        code: 'INGEST_AUTHOR_NO_PERMISSION',
      });
    }

    const emailVerificationRequired = await fastify.settings.get(
      'email_verification_required',
      false,
    );
    if (emailVerificationRequired && !author.isEmailVerified) {
      return reply.code(403).send({
        error: 'Integration author must verify email',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    request.user = enriched;
    request.ingestIntegration = integration;

    await db
      .update(forumIngestIntegrations)
      .set({ lastUsedAt: new Date() })
      .where(eq(forumIngestIntegrations.id, integration.id));
  };
}
