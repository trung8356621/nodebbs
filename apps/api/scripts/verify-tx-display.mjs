/**
 * Read-only verification of display enrichment against local DB.
 */
import { enrichTransactionForDisplay } from '../src/extensions/ledger/utils/transactionDisplay.js';
import db from '../src/db/index.js';
import { sysTransactions, sysAccounts } from '../src/db/schema.js';
import { sql, desc } from 'drizzle-orm';

const types = await db.execute(sql`
  SELECT type, COUNT(*)::int AS n
  FROM sys_transactions
  GROUP BY type
  ORDER BY n DESC
`);

const snap = await db.execute(sql`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (
      WHERE COALESCE(metadata::text, '') ~* 'creditVnd|valueVnd|vndPerCredit|credit_vnd'
    )::int AS with_snapshot_guess
  FROM sys_transactions
`);

const sample = await db
  .select({
    id: sysTransactions.id,
    userId: sysTransactions.userId,
    currencyCode: sysTransactions.currencyCode,
    amount: sysTransactions.amount,
    balance: sysTransactions.balanceAfter,
    type: sysTransactions.type,
    description: sysTransactions.description,
    metadata: sysTransactions.metadata,
    createdAt: sysTransactions.createdAt,
  })
  .from(sysTransactions)
  .orderBy(desc(sysTransactions.createdAt))
  .limit(20);

const enriched = sample.map(enrichTransactionForDisplay);
const directions = { credit: 0, debit: 0, zero: 0 };
for (const r of enriched) directions[r.direction] += 1;

const accounts = await db.execute(sql`
  SELECT COUNT(*)::int AS accounts, COALESCE(SUM(balance::numeric),0)::text AS sum_balance
  FROM sys_accounts
`);

console.log(JSON.stringify({
  types: types.rows || types,
  snapshot: (snap.rows || snap)[0],
  sampleDirections: directions,
  sampleLegacyUnknown: enriched.filter((r) => r.legacyVndUnknown).length,
  sampleSize: enriched.length,
  accounts: (accounts.rows || accounts)[0],
  samplePreview: enriched.slice(0, 5).map((r) => ({
    id: r.id,
    type: r.type,
    amountCredit: r.amountCredit,
    amountVnd: r.amountVnd,
    direction: r.direction,
    vndSource: r.vndSource,
    legacy: r.legacyVndUnknown,
  })),
}, null, 2));

process.exit(0);
