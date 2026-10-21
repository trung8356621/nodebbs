import path from 'node:path';

// Fixed identity for this process. No request can select a database or storage root.
if (process.env.FORUM_ID) {
  const id = process.env.FORUM_ID;
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(id)) throw new Error('Invalid FORUM_ID');
  for (const name of ['DATABASE_URL', 'REDIS_URL', 'REDIS_KEY_PREFIX', 'UPLOAD_ROOT', 'JWT_SECRET', 'COOKIE_SECRET', 'AUTH_COOKIE_NAME', 'FORUM_ALLOWED_HOSTS', 'FORUM_WEB_ORIGIN']) {
    if (!process.env[name]) throw new Error(`Missing isolated runtime setting: ${name}`);
  }
  if (decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)) !== process.env.FORUM_DATABASE_NAME) throw new Error('Database identity mismatch');
  if (!path.isAbsolute(process.env.UPLOAD_ROOT)) throw new Error('UPLOAD_ROOT must be absolute');
  if (process.env.REDIS_KEY_PREFIX !== `pbn:${id}:`) throw new Error('Invalid Redis namespace');
  if (process.env.AUTH_COOKIE_NAME !== `pbn_${id}_auth`) throw new Error('Invalid forum cookie');
  if (process.env.JWT_SECRET.length < 32 || process.env.COOKIE_SECRET.length < 32) throw new Error('Forum secrets too short');
  if (!Number.isInteger(Number(process.env.DB_POOL_MAX)) || Number(process.env.DB_POOL_MAX) < 1 || Number(process.env.DB_POOL_MAX) > 10) throw new Error('Invalid pool budget');
}
