import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, config, connect, sha, quote, readJson } from './forum.mjs';
import { publicCatalog } from './forum-catalog.mjs';

// Adoption certifies schema equivalence; it never pretends upstream SQL ran.
export async function adopt(c) {
  const dir = path.join(root, 'apps/api/baseline');
  const document = readJson(path.join(dir, 'manifest.json'));
  const baseline = (document.migrations || [document])[0];
  if (baseline.version !== 1) throw new Error('Missing immutable baseline v1');
  for (const entry of baseline.files) {
    if (!/^[a-zA-Z0-9_]+\.sql$/.test(entry.file) || sha(fs.readFileSync(path.join(dir, entry.file))) !== entry.sha256) throw new Error('Baseline checksum mismatch');
  }
  const client = await connect(c);
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pbn-baseline'))");
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    // Freeze public DDL/writes while equivalence and data preservation are verified.
    for (const { tablename } of tables) await client.query(`LOCK TABLE public.${quote(tablename)} IN SHARE MODE`);
    const expected = readJson(path.join(dir, 'catalog.json'));
    const actual = await publicCatalog(client);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Schema differs from baseline v1; adoption refused');
    const rows = {};
    for (const { tablename } of tables) {
      rows[tablename] = (await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text COLLATE "C"),'')) AS checksum FROM public.${quote(tablename)} t`)).rows[0];
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS pbn_meta');
    await client.query('CREATE TABLE IF NOT EXISTS pbn_meta.schema_versions(version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const existing = (await client.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows;
    const checksum = sha(JSON.stringify(baseline));
    if (existing.length && (existing.length !== 1 || existing[0].version !== 1 || existing[0].checksum !== checksum)) throw new Error('Unexpected ledger; adoption refused');
    await client.query('INSERT INTO pbn_meta.schema_versions(version,checksum) VALUES(1,$1) ON CONFLICT(version) DO NOTHING', [checksum]);
    await client.query('CREATE TABLE IF NOT EXISTS pbn_meta.schema_adoptions(version integer PRIMARY KEY REFERENCES pbn_meta.schema_versions(version), catalog jsonb NOT NULL, data_fingerprints jsonb NOT NULL, adopted_at timestamptz NOT NULL DEFAULT now())');
    await client.query('INSERT INTO pbn_meta.schema_adoptions(version,catalog,data_fingerprints) VALUES(1,$1,$2) ON CONFLICT(version) DO NOTHING', [actual, rows]);
    // Only metadata was written; all business tables remain locked and unchanged.
    await client.query('COMMIT');
    return { database: c.database, catalog: actual, rows, ledger: { version: 1, checksum }, rerun: existing.length === 1 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await adopt(config(process.argv[2])), null, 2));
}
