import crypto from 'node:crypto';
import { pool } from '../../db/index.js';
import { validateRule } from '../../services/policy/engine.js';
import { synchronizeConfigured } from '../../services/policy/sync.js';
export default async function policyRoutes(fastify) {
  const admin={preHandler:[fastify.requirePermission('dashboard.moderation')]};
  fastify.get('/',admin,async () => ({
    versions:(await pool.query('SELECT * FROM policy_versions ORDER BY scope')).rows,
    rules:(await pool.query('SELECT * FROM policy_rules ORDER BY scope,priority DESC,id')).rows,
    syncs:(await pool.query('SELECT * FROM policy_syncs ORDER BY id DESC LIMIT 20')).rows,
    decisions:(await pool.query('SELECT * FROM policy_decisions ORDER BY id DESC LIMIT 100')).rows,
    resolutions:(await pool.query("SELECT id,target_type,target_id,status,reviewed_by,reviewed_at,reason FROM moderation_items WHERE status<>'pending' ORDER BY reviewed_at DESC NULLS LAST,id DESC LIMIT 100")).rows,
    scans:(await pool.query('SELECT * FROM policy_scans ORDER BY id DESC LIMIT 20')).rows,
  }));
  async function mutate(request, operation) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='10s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('pbn-policy'))");
      const id=request.params?.id;
      if(id && !(await client.query("SELECT 1 FROM policy_rules WHERE id=$1 AND scope='local' FOR UPDATE",[id])).rowCount) {const e=new Error('Local rule not found');e.statusCode=404;throw e;}
      let rule;
      if(operation==='delete') await client.query("DELETE FROM policy_rules WHERE id=$1 AND scope='local'",[id]);
      else {
        rule=validateRule({...request.body,id:id||'l:'+crypto.randomUUID()},'local');
        await client.query(`INSERT INTO policy_rules(id,scope,category,type,value,action,priority,enabled,reason) VALUES($1,'local',$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT(id) DO UPDATE SET category=excluded.category,type=excluded.type,value=excluded.value,action=excluded.action,priority=excluded.priority,enabled=excluded.enabled,reason=excluded.reason WHERE policy_rules.scope='local'`,[rule.id,rule.category,rule.type,rule.value,rule.action,rule.priority,rule.enabled,rule.reason]);
      }
      const rules=(await client.query("SELECT * FROM policy_rules WHERE scope='local' ORDER BY id")).rows;
      const checksum=crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex');
      await client.query("INSERT INTO policy_versions(scope,version,checksum,source) VALUES('local',1,$1,'forum-admin') ON CONFLICT(scope) DO UPDATE SET version=policy_versions.version+1,checksum=excluded.checksum,applied_at=now()",[checksum]);
      await client.query("INSERT INTO policy_decisions(forum_id,user_id,content_type,action,rule_ids,reason,content_hash) VALUES($1,$2,'local_rule',$3,$4,'LOCAL_RULE_CHANGED',$5)",[process.env.FORUM_ID||'standalone',request.user.id,operation,JSON.stringify([id||rule.id]),checksum]);
      await client.query("INSERT INTO policy_scans(dry_run) SELECT false WHERE NOT EXISTS(SELECT 1 FROM policy_scans WHERE status IN ('pending','running'))");
      await client.query("UPDATE policy_scans SET target=0,cursor=0 WHERE status IN ('pending','running')");
      await client.query('COMMIT');return {success:true,rule};
    } catch(error) {await client.query('ROLLBACK'); if(error.code==='23505') {error.statusCode=409;error.message='Duplicate rule';} else if(!error.statusCode) error.statusCode=400;throw error;} finally {client.release();}
  }
  fastify.post('/rules',admin,request=>mutate(request,'create'));
  fastify.put('/rules/:id',admin,request=>mutate(request,'update'));
  fastify.delete('/rules/:id',admin,request=>mutate(request,'delete'));
  fastify.post('/sync',admin,async () => {return synchronizeConfigured(pool);});
  fastify.post('/scans',{...admin,schema:{body:{type:'object',properties:{dryRun:{type:'boolean'}},additionalProperties:false}}},async request => {
    try {return (await pool.query('INSERT INTO policy_scans(dry_run) VALUES($1) RETURNING *',[request.body?.dryRun!==false])).rows[0];}
    catch(error) {if(error.code==='23505') {error.statusCode=409;error.message='Scan already active';}throw error;}
  });
}
