import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../baseline/0011_bank_payment.sql');
const url = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5432/pbn_dev';

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query(sql);
  const check = await client.query(`
    select to_regclass('public.pbn_payment_orders') as orders,
           to_regclass('public.pbn_topup_packages') as packages,
           to_regclass('public.pbn_payment_events') as events
  `);
  console.log('applied', check.rows[0]);
} finally {
  await client.end();
}
