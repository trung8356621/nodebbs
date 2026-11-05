import { pool } from '#core/db/index.js';

const REQUIRED_TABLES = [
  'forum_ingest_integrations',
  'forum_ingest_topic_refs',
];

/**
 * Probe additive ingest schema. Missing tables must surface as 503,
 * never as Fastify "route not found".
 */
export async function tableExists(name) {
  const { rows } = await pool.query(
    `SELECT 1 AS ok
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
     LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

export async function ensureIngestSchemaReady() {
  for (const name of REQUIRED_TABLES) {
    if (!(await tableExists(name))) {
      return { ready: false, missing: name };
    }
  }
  return { ready: true, missing: null };
}

export function schemaMissingError(missing) {
  const err = new Error(
    missing
      ? `Forum ingest schema missing (${missing}). Apply additive drizzle push/migrate.`
      : 'Forum ingest schema missing.',
  );
  err.statusCode = 503;
  err.code = 'INGEST_SCHEMA_MISSING';
  err.body = {
    error: 'Forum ingest is not ready',
    code: 'INGEST_SCHEMA_MISSING',
    missing: missing || undefined,
  };
  return err;
}

export function createRequireIngestReady(fastify) {
  let cached = null;
  return async function requireIngestReady(_request, reply) {
    try {
      if (!cached?.ready) {
        cached = await ensureIngestSchemaReady();
      }
      if (!cached.ready) {
        const err = schemaMissingError(cached.missing);
        return reply.code(503).send(err.body);
      }
    } catch (error) {
      fastify.log.warn({ err: error.message }, '[forum-ingest] schema probe failed');
      return reply.code(503).send({
        error: 'Forum ingest is not ready',
        code: 'INGEST_SCHEMA_MISSING',
      });
    }
  };
}
