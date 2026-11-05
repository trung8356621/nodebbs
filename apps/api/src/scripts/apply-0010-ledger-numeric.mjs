import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sqlPath = path.join(root, 'baseline/0010_ledger_credit_numeric.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  const bal = await client.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name='sys_accounts' AND column_name='balance'`,
  );
  const hist = await client.query(`SELECT to_regclass('public.forum_credit_vnd_rate_history') AS t`);
  console.log(JSON.stringify({
    balanceType: bal.rows[0]?.data_type,
    history: hist.rows[0]?.t,
    ok: true,
  }));
} catch (e) {
  await client.query('ROLLBACK');
  console.error('MIGRATE_FAIL', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
