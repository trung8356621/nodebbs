import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  const types = await c.query(
    'select type, count(*)::int as n from sys_transactions group by type order by n desc',
  );
  const meta = await c.query(`
    select
      count(*)::int as total,
      count(*) filter (where metadata is not null and metadata <> '')::int as with_meta,
      count(*) filter (
        where coalesce(metadata,'')::text like '%creditVnd%'
           or coalesce(metadata,'')::text like '%valueVnd%'
           or coalesce(metadata,'')::text like '%credit_vnd%'
           or coalesce(metadata,'')::text like '%vndPerCredit%'
      )::int as with_rate_snapshot
    from sys_transactions
  `);
  const sample = await c.query(`
    select id, type, amount::text as amount, balance_after::text as balance_after,
           currency_code, left(coalesce(description,''), 80) as description,
           left(coalesce(metadata,''), 180) as metadata
    from sys_transactions
    order by id desc
    limit 20
  `);
  console.log(JSON.stringify({ types: types.rows, meta: meta.rows[0], sample: sample.rows }, null, 2));
} finally {
  await c.end();
}
