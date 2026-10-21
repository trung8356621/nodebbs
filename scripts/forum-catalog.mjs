import { sha } from './forum.mjs';

export async function publicCatalog(client) {
  const queries = {
    columns: "SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    constraints: "SELECT t.relname,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' ORDER BY t.relname,c.conname",
    indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  };
  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    const rows = (await client.query(query)).rows;
    result[key] = { count: rows.length, sha256: sha(JSON.stringify(rows)) };
  }
  return result;
}
