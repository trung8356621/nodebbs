import { eq, desc, and, ne, sql } from 'drizzle-orm';
import db from '#core/db/index.js';
import { users } from '#core/db/schema.js';
import { forumIngestIntegrations } from '../schema.js';
import { generateIngestToken } from '../crypto.js';
import {
  normalizeAuthorSearchQuery,
  escapeIlikePattern,
} from '../authorSearch.js';

function fail(statusCode, code, error) {
  const err = new Error(error);
  err.statusCode = statusCode;
  err.code = code;
  err.body = { error, code };
  return err;
}

/** Legacy users.role plus RBAC admin role. */
async function isAdminAuthor(fastify, author) {
  if (author.role === 'admin') return true;
  if (fastify.permission?.hasRole) {
    return fastify.permission.hasRole(author.id, 'admin');
  }
  return false;
}

function publicIntegration(row, author) {
  return {
    id: row.id,
    name: row.name,
    keyId: row.keyId,
    status: row.status,
    forumId: row.forumId,
    authorUserId: row.authorUserId,
    authorUsername: author?.username || null,
    authorName: author?.name || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    createdByUserId: row.createdByUserId,
  };
}

/**
 * Validate integration author: exists, not deleted/banned, not admin, has topic.create.
 */
export async function assertValidIngestAuthor(fastify, authorUserId) {
  const [author] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, authorUserId), eq(users.isDeleted, false)))
    .limit(1);
  if (!author) {
    throw fail(400, 'INGEST_AUTHOR_INVALID', 'Author user not found');
  }
  if (author.isBanned) {
    throw fail(400, 'INGEST_AUTHOR_BANNED', 'Author user is banned');
  }
  if (await isAdminAuthor(fastify, author)) {
    throw fail(400, 'INGEST_AUTHOR_ADMIN_FORBIDDEN', 'Do not use an admin as ingest author');
  }
  const hasCreate = await fastify.permission.hasPermission(author.id, 'topic.create');
  if (!hasCreate) {
    throw fail(400, 'INGEST_AUTHOR_NO_PERMISSION', 'Author must have topic.create permission');
  }
  const emailVerificationRequired = await fastify.settings.get(
    'email_verification_required',
    false,
  );
  if (emailVerificationRequired && !author.isEmailVerified) {
    throw fail(400, 'EMAIL_VERIFICATION_REQUIRED', 'Author must verify email first');
  }
  return author;
}

/**
 * Search eligible ingest authors for admin autocomplete.
 * Returns at most `limit` active non-admin users with topic.create.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export async function searchEligibleAuthors(fastify, query, opts = {}) {
  const q = normalizeAuthorSearchQuery(query);
  if (!q) {
    return { items: [] };
  }
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 10);
  const pattern = `%${escapeIlikePattern(q)}%`;

  const emailRequired = await fastify.settings.get('email_verification_required', false);
  const conditions = [
    eq(users.isDeleted, false),
    eq(users.isBanned, false),
    ne(users.role, 'admin'),
    sql`(
      ${users.username} ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${users.email}, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(${users.name}, '') ILIKE ${pattern} ESCAPE '\\'
    )`,
  ];
  if (emailRequired) {
    conditions.push(eq(users.isEmailVerified, true));
  }

  // Over-fetch then filter by RBAC (admin role / topic.create).
  const candidates = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      role: users.role,
      isEmailVerified: users.isEmailVerified,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.id))
    .limit(40);

  const items = [];
  for (const candidate of candidates) {
    if (await isAdminAuthor(fastify, candidate)) continue;
    const hasCreate = await fastify.permission.hasPermission(candidate.id, 'topic.create');
    if (!hasCreate) continue;
    items.push({
      id: candidate.id,
      username: candidate.username,
      name: candidate.name,
      avatar: candidate.avatar,
      email: candidate.email || null,
      isEmailVerified: candidate.isEmailVerified,
    });
    if (items.length >= limit) break;
  }

  return { items };
}

export async function listIntegrations() {
  const rows = await db
    .select({
      integration: forumIngestIntegrations,
      authorUsername: users.username,
      authorName: users.name,
    })
    .from(forumIngestIntegrations)
    .leftJoin(users, eq(users.id, forumIngestIntegrations.authorUserId))
    .orderBy(desc(forumIngestIntegrations.id));

  return rows.map((r) =>
    publicIntegration(r.integration, {
      username: r.authorUsername,
      name: r.authorName,
    }),
  );
}

/**
 * Create integration; returns plaintext token once.
 */
export async function createIntegration(fastify, { name, authorUserId, createdByUserId }) {
  const label = String(name || '').trim();
  if (!label || label.length > 120) {
    throw fail(400, 'INGEST_NAME_INVALID', 'name is required (1–120 chars)');
  }
  const author = await assertValidIngestAuthor(fastify, Number(authorUserId));
  const { keyId, token, secretHash } = generateIngestToken();

  const [row] = await db
    .insert(forumIngestIntegrations)
    .values({
      name: label,
      keyId,
      secretHash,
      authorUserId: author.id,
      forumId: process.env.FORUM_ID || null,
      status: 'active',
      createdByUserId: createdByUserId || null,
    })
    .returning();

  return {
    integration: publicIntegration(row, author),
    /** Shown only once — never stored or returned again. */
    token,
    api: {
      endpoint: 'POST /api/integrations/topics',
      authorization: 'Authorization: Bearer <token>',
      body: {
        externalRef: 'string (unique per integration)',
        title: 'string (3–255)',
        categoryId: 'number',
        content: 'Markdown string',
        tags: 'optional string[] (max 5)',
      },
      notes: [
        'Reuse the same externalRef + payload for safe retries.',
        'Different payload with the same externalRef returns 409.',
        'Content policy BLOCK/REVIEW and topic moderation still apply.',
      ],
    },
  };
}

export async function updateIntegration(fastify, id, { name, authorUserId }) {
  const [row] = await db
    .select()
    .from(forumIngestIntegrations)
    .where(eq(forumIngestIntegrations.id, id))
    .limit(1);
  if (!row) {
    throw fail(404, 'INGEST_NOT_FOUND', 'Integration not found');
  }
  if (row.status !== 'active') {
    throw fail(409, 'INGEST_REVOKED', 'Cannot update a revoked integration');
  }

  const patch = {};
  if (name !== undefined) {
    const label = String(name || '').trim();
    if (!label || label.length > 120) {
      throw fail(400, 'INGEST_NAME_INVALID', 'name is required (1–120 chars)');
    }
    patch.name = label;
  }

  let author = null;
  if (authorUserId !== undefined) {
    author = await assertValidIngestAuthor(fastify, Number(authorUserId));
    patch.authorUserId = author.id;
  }

  if (Object.keys(patch).length === 0) {
    author = author || (await db.select().from(users).where(eq(users.id, row.authorUserId)).limit(1))[0];
    return publicIntegration(row, author);
  }

  const [updated] = await db
    .update(forumIngestIntegrations)
    .set(patch)
    .where(eq(forumIngestIntegrations.id, id))
    .returning();

  if (!author) {
    [author] = await db.select().from(users).where(eq(users.id, updated.authorUserId)).limit(1);
  }
  return publicIntegration(updated, author);
}

export async function revokeIntegration(id) {
  const [row] = await db
    .select()
    .from(forumIngestIntegrations)
    .where(eq(forumIngestIntegrations.id, id))
    .limit(1);
  if (!row) {
    throw fail(404, 'INGEST_NOT_FOUND', 'Integration not found');
  }
  if (row.status === 'revoked') {
    return publicIntegration(row);
  }
  const [updated] = await db
    .update(forumIngestIntegrations)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(eq(forumIngestIntegrations.id, id))
    .returning();
  const [author] = await db.select().from(users).where(eq(users.id, updated.authorUserId)).limit(1);
  return publicIntegration(updated, author);
}
