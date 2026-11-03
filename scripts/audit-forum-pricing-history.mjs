import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/api/package.json'));
const pg = require('pg');

async function audit(name, database) {
  const c = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:5432/${database}` });
  await c.connect();
  const out = { forum: name, database };
  try {
    out.snapshots = (await c.query(`
      SELECT version, source_id, checksum, valid_until,
             payload->>'schemaVersion' AS schema_version,
             payload->>'creditVnd' AS credit_vnd,
             payload->>'contract' AS contract
      FROM ops_price_snapshots ORDER BY version`)).rows;
    out.seoPurchases = (await c.query(`
      SELECT count(*)::int AS n,
             count(paid_price)::int AS with_paid,
             min(paid_price)::bigint AS min_paid,
             max(paid_price)::bigint AS max_paid,
             count(*) FILTER (WHERE price_snapshot IS NOT NULL)::int AS with_snapshot
      FROM seo_purchases`)).rows[0];
    out.seoPurchaseSample = (await c.query(`
      SELECT id, product_id, snapshot_version, price_version, list_price, paid_price, created_at,
             (price_snapshot ? 'salePriceCredit') AS has_sale
      FROM seo_purchases ORDER BY created_at DESC LIMIT 5`)).rows;
    out.pinEntitlements = (await c.query(`
      SELECT count(*)::int AS n,
             min(price)::bigint AS min_price,
             max(price)::bigint AS max_price,
             count(transaction_id)::int AS with_tx
      FROM pin_entitlements`)).rows[0];
    out.pinProducts = (await c.query(`
      SELECT id, name, price, is_active FROM shop_items WHERE type='topic_pin' ORDER BY id`)).rows;
    out.wallet = (await c.query(`
      SELECT count(*)::int AS accounts,
             coalesce(sum(balance),0)::bigint AS total_balance
      FROM sys_accounts WHERE currency_code='credits'`)).rows[0];
    out.txTypes = (await c.query(`
      SELECT type, count(*)::int AS n, coalesce(sum(amount),0)::bigint AS sum_amount
      FROM sys_transactions WHERE currency_code='credits'
      GROUP BY type ORDER BY type`)).rows;
    out.columns = {};
    for (const table of ['seo_purchases', 'seo_quotes']) {
      out.columns[table] = (await c.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [table],
      )).rows.map((r) => r.column_name);
    }
    out.hasPricingColumns = {
      seo_purchases: ['unit_price', 'quantity', 'total_credits', 'quoted_at', 'quote_expires_at', 'pricing_provenance']
        .every((col) => out.columns.seo_purchases.includes(col)),
      seo_quotes: ['unit_price', 'quantity', 'total_credits', 'price_version', 'credit_vnd', 'status']
        .every((col) => out.columns.seo_quotes.includes(col)),
    };
  } catch (error) {
    out.error = String(error.message);
  }
  await c.end();
  return out;
}

const report = {
  auditedAt: new Date().toISOString(),
  note: 'Read-only audit. No migrations applied. Historical prices must not be recalculated from today catalog.',
  forums: [
    await audit('forum_a', 'pbn_dev'),
    await audit('forum_b', 'pbn_forum_b'),
  ],
};

console.log(JSON.stringify(report, null, 2));
