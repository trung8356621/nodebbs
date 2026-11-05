import fs from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const tables = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (
      table_name LIKE 'ops_forum%'
      OR table_name LIKE 'ops_price%'
      OR table_name LIKE 'seo_%'
      OR table_name IN ('pin_entitlements', 'pin_events')
    )
  ORDER BY 1
`);
console.log('tables:\n' + tables.rows.map((r) => r.table_name).join('\n'));
const reg = await pool.query(`
  SELECT to_regclass('public.ops_forum_connections') AS connections,
         to_regclass('public.ops_forum_pricing_snapshots') AS pricing_snapshots,
         to_regclass('public.ops_price_snapshots') AS legacy_price
`);
console.log('regclass', reg.rows[0]);
if (reg.rows[0].connections) {
  const r = await pool.query(`
    SELECT forum_id, installation_id, connection_status, api_contract_version,
           last_verified_at, (last_error IS NOT NULL) AS has_error
    FROM ops_forum_connections LIMIT 1
  `);
  console.log('connection', r.rows[0] || null);
}
if (reg.rows[0].legacy_price) {
  const r = await pool.query(`
    SELECT version, source_id, valid_until
    FROM ops_price_snapshots ORDER BY version DESC LIMIT 3
  `);
  console.log('legacy', r.rows);
}
const perms = await pool.query(`
  SELECT slug FROM permissions
  WHERE slug IN ('dashboard.shop','dashboard.ledger','dashboard.extensions')
  ORDER BY 1
`);
console.log('permissions', perms.rows.map((r) => r.slug));
const purchases = await pool.query(`SELECT count(*)::int AS n FROM seo_purchases`);
console.log('seo_purchases', purchases.rows[0]);
await pool.end();
