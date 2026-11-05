import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '../baseline/0009_forum_local_pricing.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    'select service_code, base_price_vnd, enabled, local_price_version from forum_local_services order by 1',
  );
  console.log(JSON.stringify(rows, null, 2));
  const settings = await client.query('select key, value from forum_commercial_settings order by 1');
  console.log(JSON.stringify(settings.rows, null, 2));
} finally {
  await client.end();
}
