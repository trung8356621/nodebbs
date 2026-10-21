import fp from 'fastify-plugin';
import pg from 'pg';
import { urlField } from '../services/policy/engine.js';
import { responseLocale } from '../i18n/translate.js';
import { scanBatch } from '../services/policy/scan.js';
import db, { pool, atomicWrite } from '../db/index.js';
import { ads, pages, policyDecisions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { PolicyService } from '../services/policy/service.js';
import { synchronizeConfigured } from '../services/policy/sync.js';
const message = request => responseLocale(request.headers)==='vi-VN' ? 'Không thể đăng nội dung do vi phạm quy định cộng đồng.' : 'This content cannot be published because it violates community rules.';
async function policyPlugin(fastify) {
  const policy = new PolicyService(fastify);
  const locks = new pg.Pool({connectionString:pool.options.connectionString,max:2,connectionTimeoutMillis:10000});
  fastify.decorate('policy', policy);
  fastify.moderation.register({
    type:'policy_ad', label:'advertisement', kind:'gate', defaultEnabled:true,
    setStatus: async (tx,id,status) => tx.update(ads).set({isActive:status==='approved'}).where(eq(ads.id,id)),
    settle: async (tx,item,action) => tx.update(ads).set({isActive:action==='approve'}).where(eq(ads.id,item.targetId)),
    describe: item => ({layout:'post',title:item.snapshot?.title,preview:item.snapshot?.preview}),
  });
  fastify.moderation.register({
    type:'policy_page',label:'page',kind:'gate',defaultEnabled:true,
    setStatus:async(tx,id,status)=>tx.update(pages).set({isPublished:status==='approved'}).where(eq(pages.id,id)),
    settle:async(tx,item,action)=>tx.update(pages).set({isPublished:action==='approve'}).where(eq(pages.id,item.targetId)),
    describe:item=>({layout:'post',title:item.snapshot?.title,preview:item.snapshot?.preview}),
  });
  // Acquire a shared DB-local policy lock after existing route authentication/authorization.
  // It spans candidate evaluation through publication, so sync/rule changes cannot race writes.
  fastify.addHook('onRoute', route => {
    const url=route.url;
    const registrationRoute=url==='/api/auth/register';
    const profileRoute=/^\/api\/users(?:\/(?:me|:userId))?\/?$/.test(url);
    const pageRoute=/^\/api\/pages\/admin(?:\/:id)?$/.test(url);
    const contentRoute = /^\/api\/(topics|posts)(\/:[^/]+)?\/?$/.test(url) || profileRoute || pageRoute || registrationRoute || /^\/api\/ads(\/:[^/]+)?\/?$/.test(url);
    const moderationRoute = url.includes('/moderation');
    const methods=Array.isArray(route.method)?route.method:[route.method];
    if ((!contentRoute && !moderationRoute) || !methods.some(m=>['POST','PATCH','PUT'].includes(m))) return;
    const handlers=route.preHandler ? [].concat(route.preHandler) : [];
    handlers.push(async (request,reply) => {
      if (!request.user && !registrationRoute) return reply.code(401).send({error:'Authentication required'});
      const client=await locks.connect(); request.policyLock=client;
      await client.query("SET lock_timeout='10s'");
      await client.query("SELECT pg_advisory_lock_shared(hashtext('pbn-policy'))");
      if (!contentRoute) {
        if(url.includes('/approve/:type/:id')) await policy.approval({targetType:request.params.type,targetId:request.params.id,reviewedBy:request.user.id});
        return;
      }
      const body=request.body || {}, id=Number(request.params?.id) || null;
      let resource;
      if (/\/topics/.test(url) && id) resource='topic:'+id;
      else if (/\/posts/.test(url)) {
        const topicId=id?(await client.query('SELECT topic_id FROM posts WHERE id=$1',[id])).rows[0]?.topic_id:body.topicId;
        if(topicId)resource='topic:'+Number(topicId);
      } else if(profileRoute && (request.params?.userId || url==='/api/users/me')) resource='user:'+Number(request.params?.userId || request.user.id);
      else if(id) resource=(pageRoute?'page:':'ad:')+id;
      if(resource) {
        await client.query("SELECT pg_advisory_lock(hashtext('pbn-content'),hashtext($1))",[resource]);
        request.policyContentLock=resource;
      }
      let type, candidate;
      if (/\/topics/.test(url)) {
        type='topic';
        const previous=id ? (await client.query('SELECT t.title,p.content FROM topics t LEFT JOIN posts p ON p.topic_id=t.id AND p.post_number=1 WHERE t.id=$1',[id])).rows[0] : {};
        candidate=[body.title ?? previous?.title,body.content ?? previous?.content,...(body.tags || [])].filter(v=>v!==undefined).join('\n');
      } else if (/\/posts/.test(url)) {
        type='post';candidate=body.content || '';
        if(id) {const current=(await client.query('SELECT p.post_number,t.title FROM posts p JOIN topics t ON t.id=p.topic_id WHERE p.id=$1',[id])).rows[0];if(current?.post_number===1)candidate=current.title+'\n'+candidate;}
      }
      else if (profileRoute || registrationRoute) {
        type='profile';const userId=Number(request.params?.userId || (url==='/api/users/me'?request.user.id:0));
        const old=userId?(await client.query('SELECT name,bio,avatar FROM users WHERE id=$1',[userId])).rows[0]:{};
        candidate=[body.name??old?.name,body.bio??old?.bio,urlField(body.avatar??old?.avatar)].filter(v=>v!==undefined).join('\n');
      }
      else if(pageRoute) {
        type='policy_page';const old=id?(await client.query('SELECT title,content,type FROM pages WHERE id=$1',[id])).rows[0]:{};
        candidate=[body.title??old?.title,body.content??old?.content].filter(Boolean).join('\n');request.policyActivePage=(body.type??old?.type)==='html';
      }
      else {
        type='policy_ad';
        const previous=id ? (await client.query('SELECT * FROM ads WHERE id=$1',[id])).rows[0] : {};
        const ad={...previous,...body};
        // Active JavaScript ads cannot be inspected reliably by static URL rules.
        candidate=[ad.title,ad.type==='image'?urlField(ad.content):ad.content,urlField(body.linkUrl ?? previous?.link_url)].filter(Boolean).join('\n');
        request.policyActiveAd=['script','html'].includes(ad.type);
      }
      const decision=await policy.inspect(candidate,type,id,request.user?.id || null,client);
      if(type==='policy_ad' && request.policyActiveAd && decision.action==='ALLOW') {decision.action='REVIEW';decision.reason='ACTIVE_AD_REQUIRES_REVIEW'; await client.query("UPDATE policy_decisions SET action='REVIEW',reason=$1 WHERE id=$2",[decision.reason,decision.id]);}
      if(type==='policy_page' && request.policyActivePage && decision.action==='ALLOW') {decision.action='REVIEW';decision.reason='ACTIVE_PAGE_REQUIRES_REVIEW';await client.query("UPDATE policy_decisions SET action='REVIEW',reason=$1 WHERE id=$2",[decision.reason,decision.id]);}
      request.policyDecision=decision;
      if(decision.action==='BLOCK') return reply.code(422).send({error:message(request),code:'POLICY_BLOCKED',decisionId:decision.id});
      if(type==='profile' && decision.action==='REVIEW' && url!=='/api/users/me' && body.name!==undefined) {request.policyName=body.name;delete body.name;}
      if(type==='policy_page' && decision.action==='REVIEW') {request.policyPageReview=true;body.isPublished=false;}
      if(type==='policy_ad' && decision.action==='REVIEW') {request.policyAdReview=true;body.isActive=false;}
    });
    route.preHandler=handlers;
    if(contentRoute || moderationRoute) {
      const handler=route.handler;
      route.handler=async function(request,reply) {
        let result;
        const rejected=Symbol('rejected');
        try {
          await atomicWrite(async()=> {
            result=await handler.call(this,request,reply);
            if(reply.statusCode>=400) throw rejected;
            const userId=result?.user?.id || result?.id || Number(request.params?.userId);
            if(request.policyName!==undefined && userId) await fastify.moderation.submit({targetType:'user_name',targetId:userId,value:request.policyName,submittedBy:request.user?.id || userId,forceReview:true});
            if(request.policyPageReview && result?.id) await fastify.moderation.submitForReview({targetType:'policy_page',targetId:result.id,submittedBy:request.user.id,snapshot:{title:result.title,preview:request.policyDecision.reason,policyDecisionId:request.policyDecision.id}});
            if(request.policyAdReview && result?.id) await fastify.moderation.submitForReview({targetType:'policy_ad',targetId:result.id,submittedBy:request.user.id,snapshot:{title:result.title,preview:request.policyDecision.reason,policyDecisionId:request.policyDecision.id}});
            const contentId=result?.topic?.id || result?.post?.id || result?.id;
            if(request.policyDecision && contentId) await db.update(policyDecisions).set({contentId}).where(eq(policyDecisions.id,request.policyDecision.id));
          });
        } catch(error) {if(error!==rejected)throw error;}
        if(request.policyDecision?.action==='REVIEW' && result && typeof result==='object' && !reply.sent) result.message=responseLocale(request.headers)==='vi-VN'?'Nội dung đang chờ kiểm duyệt.':'Your content is pending moderation.';
        return result;
      };
    }
  });
  async function release(request) {
    const client=request.policyLock; if(!client) return; request.policyLock=null;
    try {if(request.policyContentLock)await client.query("SELECT pg_advisory_unlock(hashtext('pbn-content'),hashtext($1))",[request.policyContentLock]);await client.query("SELECT pg_advisory_unlock_shared(hashtext('pbn-policy'))");await client.query('RESET lock_timeout');client.release();} catch(error) {client.release(error);}
  }
  fastify.addHook('onResponse',release);
  fastify.addHook('onError',async request => {await release(request);});
  // Optional operator-configured file provider, no central server or per-post network request.
  const interval=Number(process.env.POLICY_SYNC_INTERVAL_MS || 300000);
  let busy=false;
  const sync=async () => {if(busy || !process.env.POLICY_SNAPSHOT_FILE) return; busy=true; try {await synchronizeConfigured(pool);} catch(error) {fastify.log.warn({reason:error.message},'Policy sync failed; last verified snapshot retained');} finally {busy=false;}};
  const timer=setInterval(sync,Math.max(60000,interval));timer.unref();
  let scanning=false;
  const scanner=setInterval(async()=>{if(scanning)return;scanning=true;try { const progress=await scanBatch(pool,policy,process.env.POLICY_SCAN_BATCH_SIZE);if(progress)fastify.log.info(progress,'Policy scan progress'); }catch(error){fastify.log.warn({reason:error.message},'Policy scan batch failed; checkpoint retained');}finally{scanning=false;}},Math.max(1000,Number(process.env.POLICY_SCAN_INTERVAL_MS)||5000));scanner.unref();
  fastify.addHook('onReady',sync);
  fastify.addHook('onClose',async()=>{clearInterval(timer);clearInterval(scanner);await locks.end();});
}
export default fp(policyPlugin,{name:'policy',dependencies:['db','moderation','auth']});
