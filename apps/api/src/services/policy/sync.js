import fs from 'node:fs';
import crypto from 'node:crypto';
import { validateRule } from './engine.js';
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export async function synchronize(pool, envelope, publicKey, source = 'operator-fixture') {
  let version = null;
  const client = await pool.connect();
  try {
    if (typeof envelope?.payload !== 'string' || envelope.payload.length > 1400000 || typeof envelope.signature !== 'string') throw new Error('Invalid signed envelope');
    const bytes = Buffer.from(envelope.payload, 'base64');
    if (bytes.length > 1000000 || digest(bytes) !== envelope.checksum || !crypto.verify(null, bytes, publicKey, Buffer.from(envelope.signature, 'base64'))) throw new Error('Policy authentication failed');
    const payload = JSON.parse(bytes.toString('utf8'));
    version = payload.version;
    if (payload.schemaVersion !== 1 || !Number.isSafeInteger(version) || version < 1 || !Array.isArray(payload.rules) || payload.rules.length > 5000) throw new Error('Invalid policy payload');
    const rules = payload.rules.map(r => validateRule(r, 'global'));
    if (rules.some(r => typeof r.id !== 'string' || !/^g:[a-z0-9_-]{1,100}$/.test(r.id)) || new Set(rules.map(r => r.id)).size !== rules.length || new Set(rules.map(r => r.type+'\0'+r.value)).size !== rules.length) throw new Error('Duplicate/invalid global rule identity');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pbn-policy'))");
    const old = (await client.query("SELECT version,checksum FROM policy_versions WHERE scope='global' FOR UPDATE")).rows[0];
    if (old && (old.version > version || (old.version === version && old.checksum !== envelope.checksum))) throw new Error('Policy downgrade/replay conflict');
    if (!old || old.version !== version) {
      await client.query("DELETE FROM policy_rules WHERE scope='global'");
      for (const r of rules) await client.query('INSERT INTO policy_rules(id,scope,category,type,value,action,priority,enabled,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,r.scope,r.category,r.type,r.value,r.action,r.priority,r.enabled,r.reason]);
      await client.query("INSERT INTO policy_versions(scope,version,checksum,source) VALUES('global',$1,$2,$3) ON CONFLICT(scope) DO UPDATE SET version=excluded.version,checksum=excluded.checksum,source=excluded.source,applied_at=now()",[version,envelope.checksum,source]);
      // One resumable job per installation, with a database-enforced active-job uniqueness guard.
      await client.query("INSERT INTO policy_scans(dry_run) SELECT false WHERE NOT EXISTS(SELECT 1 FROM policy_scans WHERE status IN ('pending','running'))");
      await client.query("UPDATE policy_scans SET target=0,cursor=0 WHERE status IN ('pending','running')");
    }
    await client.query("INSERT INTO policy_syncs(success,version,reason) VALUES(true,$1,'VERIFIED')",[version]);
    await client.query('COMMIT');
    return {version,checksum:envelope.checksum,rules:rules.length};
  } catch (error) {
    await client.query('ROLLBACK');
    await client.query("INSERT INTO policy_syncs(success,version,reason) VALUES(false,$1,$2)",[Number.isSafeInteger(version)?version:null,String(error.message).slice(0,500)]);
    throw error;
  } finally { client.release(); }
}
export function configuredSnapshot() {
  if (!process.env.POLICY_SNAPSHOT_FILE || !process.env.POLICY_TRUST_KEY_FILE) throw new Error('Policy source/trust key not configured');
  const file = process.env.POLICY_SNAPSHOT_FILE;
  if (fs.statSync(file).size > 1500000) throw new Error('Snapshot too large');
  return { envelope: JSON.parse(fs.readFileSync(file,'utf8')), key: fs.readFileSync(process.env.POLICY_TRUST_KEY_FILE,'utf8') };
}

export async function synchronizeConfigured(pool) {
  let source;
  try {source=configuredSnapshot();}
  catch(error) {
    await pool.query("INSERT INTO policy_syncs(success,reason) VALUES(false,'POLICY_SOURCE_UNAVAILABLE')");
    throw error;
  }
  return synchronize(pool,source.envelope,source.key,'operator-file-provider');
}
