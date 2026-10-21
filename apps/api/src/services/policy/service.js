import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import db, { pool } from '../../db/index.js';
import { evaluate, urlField } from './engine.js';
export class PolicyService {
  constructor(fastify) { this.fastify = fastify; }
  async inspect(content, type, id = null, userId = null, client = pool, forced = null) {
    const rules = (await client.query('SELECT * FROM policy_rules ORDER BY priority DESC,id')).rows;
    const ready = (await client.query("SELECT 1 FROM policy_versions WHERE scope='global'")).rowCount;
    const result = forced || evaluate(content, rules);
    if (!ready && result.action !== 'BLOCK') { result.action='REVIEW'; result.reason='GLOBAL_SNAPSHOT_NOT_CONFIGURED'; }
    const [decision] = (await client.query('INSERT INTO policy_decisions(forum_id,user_id,content_type,content_id,action,rule_ids,reason,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [process.env.FORUM_ID || 'standalone',userId,type,id,result.action,JSON.stringify(result.ruleIds),result.reason,crypto.createHash('sha256').update(content).digest('hex')])).rows;
    return {...result,id:decision.id};
  }
  async content(type,id,client=pool) {
    if (type === 'topic') {
      const row=(await client.query('SELECT t.title,p.content FROM topics t LEFT JOIN posts p ON p.topic_id=t.id AND p.post_number=1 WHERE t.id=$1',[id])).rows[0];
      return row ? [row.title,row.content].join('\n') : '';
    }
    if(type==='policy_page') {const row=(await client.query('SELECT title,content FROM pages WHERE id=$1',[id])).rows[0];return row?Object.values(row).join('\n'):'';}
    if (type === 'post') {const row=(await client.query('SELECT p.content,p.post_number,t.title FROM posts p JOIN topics t ON t.id=p.topic_id WHERE p.id=$1',[id])).rows[0];return row?((row.post_number===1?row.title+'\n':'')+row.content):'';}
    if (type === 'policy_ad') { const row=(await client.query('SELECT title,content,link_url,type FROM ads WHERE id=$1',[id])).rows[0]; return row ? [row.title,row.type==='image'?urlField(row.content):row.content,urlField(row.link_url)].join('\n') : ''; }
    return '';
  }
  async approval(item) {
    const table={topic:'topics',post:'posts',policy_ad:'ads',policy_page:'pages',user_name:'users',user_bio:'users',user_avatar:'users'}[item.targetType];
    if(table) await db.execute(sql.raw('SELECT id FROM '+table+' WHERE id='+Number(item.targetId)+' FOR UPDATE'));
    if(item.targetType==='topic') await db.execute(sql.raw('SELECT id FROM posts WHERE topic_id='+Number(item.targetId)+' AND post_number=1 FOR UPDATE'));
    if(item.targetType==='policy_page' && (await pool.query('SELECT type FROM pages WHERE id=$1',[item.targetId])).rows[0]?.type==='html') {const error=new Error('Active HTML pages require a reviewed safe renderer. Convert this page to Markdown or text before approval.');error.statusCode=422;throw error;}
    if(item.targetType==='policy_ad') {
      const ad=(await pool.query('SELECT type FROM ads WHERE id=$1',[item.targetId])).rows[0];
      if(ad && ['script','html'].includes(ad.type)) {const error=new Error('Active advertisement formats require a reviewed safe renderer. Convert this advertisement to an image before approval.');error.statusCode=422;throw error;}
    }
    const content = ['topic','post','policy_ad','policy_page'].includes(item.targetType) ? await this.content(item.targetType,item.targetId) : item.targetType==='user_avatar'?urlField(item.payload?.value):String(item.payload?.value || '');
    const decision = await this.inspect(content,item.targetType,item.targetId,item.reviewedBy);
    if (decision.action === 'BLOCK' || decision.reason === 'GLOBAL_SNAPSHOT_NOT_CONFIGURED') {
      const error=new Error('This content cannot be published because it violates community rules.'); error.statusCode=422; throw error;
    }
  }
}
