import { eq, and, sql } from 'drizzle-orm';
import db from '#core/db/index.js';
import { createTopic } from '#modules/forum/services/topicCreateService.js';
import { forumIngestTopicRefs } from '../schema.js';
import {
  assertMarkdownContent,
  hashIngestPayload,
} from '../crypto.js';
import { resolveTopicCanonicalUrl } from './canonicalUrl.js';

function fail(statusCode, code, error) {
  const err = new Error(error);
  err.statusCode = statusCode;
  err.code = code;
  err.body = { error, code };
  return err;
}

/**
 * Publish a Markdown topic via machine ingest with atomic idempotency.
 * Relies on policy atomicWrite transaction + advisory lock.
 */
export async function ingestTopic(fastify, request, body) {
  const integration = request.ingestIntegration;
  if (!integration) {
    throw fail(401, 'INGEST_AUTH_INVALID', 'Ingest authentication required');
  }

  const externalRef = String(body.externalRef || '').trim();
  if (!externalRef || externalRef.length > 191) {
    throw fail(400, 'EXTERNAL_REF_INVALID', 'externalRef is required (1–191 chars)');
  }

  assertMarkdownContent(body.content);

  const title = String(body.title || '');
  const categoryId = Number(body.categoryId);
  const content = String(body.content);
  const tags = Array.isArray(body.tags) ? body.tags : undefined;

  if (title.trim().length < 3 || title.length > 255) {
    throw fail(400, 'TITLE_INVALID', 'title must be 3–255 characters');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw fail(400, 'CATEGORY_INVALID', 'categoryId must be a positive integer');
  }

  const payloadHash = hashIngestPayload({ title, categoryId, content, tags });
  const lockKey = `${integration.id}:${externalRef}`;

  // Fail fast if public origin is misconfigured (before creating a topic).
  await resolveTopicCanonicalUrl(fastify, 0);

  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('forum-ingest'), hashtext(${lockKey}))`,
  );

  const [existing] = await db
    .select()
    .from(forumIngestTopicRefs)
    .where(
      and(
        eq(forumIngestTopicRefs.integrationId, integration.id),
        eq(forumIngestTopicRefs.externalRef, externalRef),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw fail(
        409,
        'INGEST_IDEMPOTENCY_CONFLICT',
        'externalRef was already used with a different payload',
      );
    }
    return {
      topicId: existing.topicId,
      canonicalUrl: existing.canonicalUrl,
      approvalStatus: existing.approvalStatus,
      requiresApproval: existing.requiresApproval === 1,
      idempotent: true,
    };
  }

  const created = await createTopic(fastify, request, {
    title,
    categoryId,
    content,
    tags,
  });

  const approvalStatus = created.topic.approvalStatus;
  const requiresApproval = !!created.requiresApproval;
  const canonicalUrl = await resolveTopicCanonicalUrl(fastify, created.topic.id);

  await db.insert(forumIngestTopicRefs).values({
    integrationId: integration.id,
    externalRef,
    payloadHash,
    topicId: created.topic.id,
    approvalStatus,
    requiresApproval: requiresApproval ? 1 : 0,
    canonicalUrl,
  });

  return {
    topicId: created.topic.id,
    canonicalUrl,
    approvalStatus,
    requiresApproval,
    idempotent: false,
    message: created.message,
  };
}
