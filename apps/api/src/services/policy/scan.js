import { urlField } from './engine.js';
export async function scanBatch(pool, policy, batchSize = 25) {
  const limit = Math.max(1,Math.min(100,Number(batchSize)||25));
  const client=await pool.connect();
  let jobId=null;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('pbn-policy'))");
    const job=(await client.query("SELECT * FROM policy_scans WHERE status IN ('pending','running') ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
    if(!job) {await client.query('COMMIT');return null;}
    const sources=[
      {sql:'SELECT t.id,t.user_id,t.title,p.content FROM topics t LEFT JOIN posts p ON p.topic_id=t.id AND p.post_number=1 WHERE t.id>$1 ORDER BY t.id LIMIT $2',type:'topic'},
      {sql:'SELECT id,user_id,content FROM posts WHERE id>$1 AND post_number>1 ORDER BY id LIMIT $2',type:'post'},
      {sql:'SELECT id,id AS user_id,bio,avatar,name FROM users WHERE id>$1 ORDER BY id LIMIT $2',type:'profile'},
      {sql:'SELECT id,title,content,link_url,type FROM ads WHERE id>$1 ORDER BY id LIMIT $2',type:'policy_ad'},
      {sql:'SELECT id,title,content,type FROM pages WHERE id>$1 ORDER BY id LIMIT $2',type:'policy_page'},
    ];
    jobId=job.id;
    const source=sources[job.target];
    if(!source) {await client.query("UPDATE policy_scans SET status='completed',updated_at=now() WHERE id=$1",[job.id]);await client.query('COMMIT');return {id:job.id,status:'completed'};}
    const rows=(await client.query(source.sql,[job.cursor,limit])).rows;
    let affected=0;
    for(const row of rows) {
      let text=Object.entries(row).filter(([key])=>!['id','user_id'].includes(key)).map(([,v])=>v||'').join('\n');
      if(source.type==='profile')text+='\n'+urlField(row.avatar);
      if(source.type==='policy_ad')text+='\n'+urlField(row.link_url)+'\n'+(row.type==='image'?urlField(row.content):'');
      const decision=await policy.inspect(text,source.type,row.id,row.user_id||null,client);
      if(source.type==='policy_ad' && ['html','script'].includes(row.type) && decision.action==='ALLOW') {decision.action='REVIEW';decision.reason='ACTIVE_AD_REQUIRES_REVIEW';await client.query("UPDATE policy_decisions SET action='REVIEW',reason=$1 WHERE id=$2",[decision.reason,decision.id]);}
      if(source.type==='policy_page' && row.type==='html' && decision.action==='ALLOW') {decision.action='REVIEW';decision.reason='ACTIVE_PAGE_REQUIRES_REVIEW';await client.query("UPDATE policy_decisions SET action='REVIEW',reason=$1 WHERE id=$2",[decision.reason,decision.id]);}
      if(decision.action==='ALLOW') continue;
      affected++;
      if(job.dry_run) continue;
      const cases=[];
      if(source.type==='topic') {
        await client.query("UPDATE topics SET approval_status='pending' WHERE id=$1",[row.id]);
        await client.query("UPDATE posts SET approval_status='pending' WHERE topic_id=$1 AND post_number=1",[row.id]);
        cases.push({type:'topic',value:null});
      } else if(source.type==='post') {
        await client.query("UPDATE posts SET approval_status='pending' WHERE id=$1",[row.id]);cases.push({type:'post',value:null});
      } else if(source.type==='policy_page') {
        await client.query('UPDATE pages SET is_published=false WHERE id=$1',[row.id]);cases.push({type:'policy_page',value:null});
      } else if(source.type==='policy_ad') {
        await client.query('UPDATE ads SET is_active=false WHERE id=$1',[row.id]);cases.push({type:'policy_ad',value:null});
      } else {
        for(const field of ['bio','avatar','name']) {
          if(!row[field]) continue;
          const d=await policy.inspect(field==='avatar'?urlField(row[field]):row[field],'user_'+field,row.id,row.id,client);
          if(d.action==='ALLOW') continue;
          // Known identifiers only; original value is retained privately in the existing queue.
          await client.query(`UPDATE users SET ${field}=NULL WHERE id=$1`,[row.id]);
          cases.push({type:'user_'+field,value:row[field]});
        }
      }
      for(const item of cases) {
        const existing=(await client.query("SELECT id FROM moderation_items WHERE target_type=$1 AND target_id=$2 AND status='pending' FOR UPDATE",[item.type,row.id])).rows[0];
        const snapshot={title:row.title,preview:text.slice(0,200),policyDecisionId:decision.id,scanId:job.id};
        if(existing) {
          // Keep staged proposals and also retain any published profile value hidden by this scan.
          if(item.value!==null) snapshot.previousPublishedValue=item.value;
          await client.query("UPDATE moderation_items SET snapshot=coalesce(snapshot,'{}'::jsonb) || $2::jsonb,reason=$3 WHERE id=$1",[existing.id,JSON.stringify(snapshot),decision.reason]);
        } else await client.query("INSERT INTO moderation_items(target_type,target_id,submitted_by,status,payload,snapshot,reason) VALUES($1,$2,$3,'pending',$4,$5,$6)",
          [item.type,row.id,row.user_id||null,item.value===null?null:JSON.stringify({value:item.value}),JSON.stringify(snapshot),decision.reason]);
      }
    }
    await client.query("UPDATE policy_scans SET status='running',target=$2,cursor=$3,scanned=scanned+$4,affected=affected+$5,error=NULL,updated_at=now() WHERE id=$1",[job.id,rows.length?job.target:job.target+1,rows.length?rows.at(-1).id:0,rows.length,affected]);
    await client.query('COMMIT');
    return {id:job.id,scanned:rows.length,affected,dryRun:job.dry_run};
  } catch(error) {await client.query('ROLLBACK');if(jobId)await client.query('UPDATE policy_scans SET error=$2,updated_at=now() WHERE id=$1',[jobId,String(error.message).slice(0,500)]);throw error;} finally {client.release();}
}
