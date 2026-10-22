import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {config,runtime,readJson} from './forum.mjs';
const boot=readJson('docs/audit/PHASE2.3-bootstrap-results.json');const c={...config('forums/forum-b.json'),id:boot.database,database:boot.database};Object.assign(process.env,runtime(c));
const {default:db,pool,atomicWrite}=await import('../apps/api/src/db/index.js');
const {users,categories,topics,posts,sysCurrencies,shopItems}=await import('../apps/api/src/db/schema.js');
const {LedgerService}=await import('../apps/api/src/extensions/ledger/services/ledgerService.js');
const {PinService,effectivePinned,effectiveLinkPolicy,rows}=await import('../apps/api/src/modules/forum/services/pinService.js');
const {buyItem,giftItem}=await import('../apps/api/src/extensions/shop/services/shopService.js');
const {PolicyService}=await import('../apps/api/src/services/policy/service.js');
const {synchronize}=await import('../apps/api/src/services/policy/sync.js');
const {sql,eq}=await import('../apps/api/node_modules/drizzle-orm/index.js');
const checks=[];const pass=name=>{checks.push({name,status:'PASS'});console.log('PASS '+name);};
const f={};f.ledger=new LedgerService(f);f.policy=new PolicyService(f);const service=new PinService(f);
const key=()=>crypto.randomUUID();
try{
 const keys=crypto.generateKeyPairSync('ed25519'),payload=Buffer.from(JSON.stringify(readJson('scripts/fixtures/policy-development.json')));
 await synchronize(pool,{payload:payload.toString('base64'),checksum:crypto.createHash('sha256').update(payload).digest('hex'),signature:crypto.sign(null,payload,keys.privateKey).toString('base64')},keys.publicKey);
 await db.insert(sysCurrencies).values({code:'credits',name:'Credit',symbol:'CR'}).onConflictDoNothing();
 const [u]=await db.insert(users).values({username:'pin_test_'+Date.now()}).returning();const [v]=await db.insert(users).values({username:'pin_other_'+Date.now()}).returning();
 const [cat]=await db.insert(categories).values({name:'Pin tests',slug:'pin-tests-'+Date.now()}).returning();
 const newTopic=async(content='[Reference](https://example.org/research)')=>{const [t]=await db.insert(topics).values({userId:u.id,categoryId:cat.id,title:'Pin test '+key(),slug:key(),approvalStatus:'approved'}).returning();await db.insert(posts).values({userId:u.id,topicId:t.id,postNumber:1,content,rawContent:content,approvalStatus:'approved'});return t;};
 const [plan]=await db.insert(shopItems).values({type:'topic_pin',name:'60 second test plan',price:10,currencyCode:'credits',metadata:JSON.stringify({durationSeconds:60}),isActive:true}).returning();
 const buy=(t,k=key(),productId=plan.id)=>service.purchase({userId:u.id,topicId:t.id,productId,idempotencyKey:k});
 const pair=[];for(let i=0;i<2;i++){const [t]=await db.insert(topics).values({userId:v.id,categoryId:cat.id,title:'Two purchase race '+key(),slug:key(),approvalStatus:'approved'}).returning();await db.insert(posts).values({userId:v.id,topicId:t.id,postNumber:1,content:'Ordinary reference',rawContent:'Ordinary reference',approvalStatus:'approved'});pair.push(t);}
 await f.ledger.grant({userId:v.id,amount:15,currencyCode:'credits',type:'test_fixture',referenceId:key()});
 const competing=await Promise.allSettled(pair.map(t=>service.purchase({userId:v.id,topicId:t.id,productId:plan.id,idempotencyKey:key()})));assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.ledger.getAccount(v.id,'credits')).balance,5);
 pass('Two purchases compete for 15 Credit: one 10-Credit purchase succeeds, one fails, 5 remain');

 const balance=async()=>Number((await f.ledger.getAccount(u.id,'credits')).balance);
 await f.ledger.grant({userId:u.id,amount:55,currencyCode:'credits',type:'test_fixture',referenceId:key()});
 const ts=await Promise.all(Array.from({length:20},()=>newTopic()));
 const attempts=await Promise.allSettled(ts.map(t=>buy(t)));
 if(!attempts.some(x=>x.status==='fulfilled'))console.log(attempts[0].reason);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,5);assert.equal(await balance(),5);
 const entries=await rows(sql`SELECT * FROM sys_transactions WHERE user_id=${u.id} ORDER BY id`);assert.equal(entries.filter(e=>e.type==='pin_purchase').length,5);assert.equal(entries.at(-1).balance_after,'5');
 pass('20 concurrent distinct purchases: exactly 5 affordable charges, balance 5, no overspend or lost update');
 const mixedBefore=await balance();const mixedTopics=await Promise.all(Array.from({length:10},()=>newTopic()));
 const mixed=await Promise.allSettled([...Array.from({length:20},()=>f.ledger.grant({userId:u.id,amount:1,currencyCode:'credits',type:'test_fixture',referenceId:key()})),...mixedTopics.map(t=>buy(t))]);
 const successful=mixed.slice(20).filter(r=>r.status==='fulfilled').length;assert.equal(mixed.slice(0,20).filter(r=>r.status==='fulfilled').length,20);assert.equal(await balance(),mixedBefore+20-successful*10);
 pass('Concurrent internal fixture grants and purchases conserve Credit exactly without lost updates');

 await f.ledger.grant({userId:u.id,amount:100,currencyCode:'credits',type:'test_fixture',referenceId:key()});const t=await newTopic(),k=key();const before=await balance();
 const same=await Promise.all(Array.from({length:20},()=>buy(t,k)));assert.equal(new Set(same.map(e=>e.id)).size,1);assert.equal(await balance(),before-10);
 await assert.rejects(buy(ts[0],k),e=>e.statusCode===409);assert.equal(await balance(),before-10);
 pass('20 concurrent duplicate keys return one committed purchase; conflicting topic payload is 409');
 const quoteBalance=await balance();await assert.rejects(service.purchase({userId:u.id,topicId:t.id,productId:plan.id,idempotencyKey:key(),expectedPrice:1,expectedDuration:60}),e=>e.statusCode===409);assert.equal(await balance(),quoteBalance);
 pass('Stale price confirmation is rejected without charging');
 const manual=await newTopic();await db.update(topics).set({isPinned:true}).where(eq(topics.id,manual.id));
 const manualPolicy=async()=>(await db.select({pinned:effectivePinned,policy:effectiveLinkPolicy}).from(topics).where(eq(topics.id,manual.id)))[0];assert.deepEqual(await manualPolicy(),{pinned:true,policy:'ugc'});
 await buy(manual);await db.update(topics).set({isPinned:false}).where(eq(topics.id,manual.id));assert.deepEqual(await manualPolicy(),{pinned:true,policy:'paid'});await service.cancel(manual.id,u.id);await db.update(topics).set({isPinned:true}).where(eq(topics.id,manual.id));assert.deepEqual(await manualPolicy(),{pinned:true,policy:'ugc'});
 pass('Moderator pin flag and paid entitlement remain independent; a moderator pin alone never grants editorial links');

 const original=same[0];const renewed=await buy(t);assert.equal(new Date(renewed.starts_at).getTime(),new Date(original.ends_at).getTime());assert.equal(new Date(renewed.ends_at)-new Date(renewed.starts_at),60000);
 const b=await balance();await db.update(posts).set({content:'Edited for free'}).where(eq(posts.topicId,t.id));assert.equal(await balance(),b);assert.equal(new Date((await rows(sql`SELECT ends_at FROM pin_entitlements WHERE id=${renewed.id}::uuid`))[0].ends_at).toISOString(),new Date(renewed.ends_at).toISOString());
 pass('Renewal extends the existing end exactly; ordinary content edit is free and preserves terms');
 await pool.query("CREATE FUNCTION test_pin_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected event failure'; END $$; CREATE TRIGGER test_pin_fail BEFORE INSERT ON pin_events FOR EACH ROW EXECUTE FUNCTION test_pin_fail()");
 const rollback=await newTopic(),rb=await balance();const count=Number((await pool.query('SELECT count(*) AS n FROM pin_entitlements')).rows[0].n);await assert.rejects(buy(rollback));assert.equal(await balance(),rb);assert.equal(Number((await pool.query('SELECT count(*) AS n FROM pin_entitlements')).rows[0].n),count);await pool.query('DROP TRIGGER test_pin_fail ON pin_events; DROP FUNCTION test_pin_fail()');
 pass('Injected event persistence failure rolls back wallet debit, transaction and entitlement together');
 await assert.rejects(service.purchase({userId:v.id,topicId:t.id,productId:plan.id,idempotencyKey:key()}),e=>e.statusCode===403);
 const blocked=await newTopic('https://blocked.example.test');const pre=await balance();await assert.rejects(buy(blocked),e=>e.statusCode===422);assert.equal(await balance(),pre);
 const pending=await newTopic();await db.update(topics).set({approvalStatus:'pending'}).where(eq(topics.id,pending.id));await assert.rejects(buy(pending),e=>e.statusCode===409);
 pass('Ownership, pending moderation and global policy blocks deny purchase without charging');
 const editorial=await newTopic();await service.classify(editorial.id,v.id,{editorial:true,advertising:false,reason:'Independently checked research reference'});
 const policy=async id=>(await db.select({pin:effectivePinned,policy:effectiveLinkPolicy}).from(topics).where(eq(topics.id,id)))[0];assert.equal((await policy(editorial.id)).policy,'editorial');await db.update(posts).set({content:'Changed after review'}).where(eq(posts.topicId,editorial.id));assert.equal((await policy(editorial.id)).policy,'ugc');
 await assert.rejects(service.classify(t.id,v.id,{editorial:true,advertising:false,reason:'Cannot launder paid placement into editorial'}),e=>e.statusCode===409);
 await service.classify(editorial.id,v.id,{editorial:false,advertising:true,reason:'Explicit advertising classification'});await assert.rejects(service.classify(editorial.id,v.id,{editorial:true,advertising:false,reason:'Attempt advertising classification removal'}),e=>e.statusCode===409);assert.equal((await policy(editorial.id)).policy,'sponsored');
 pass('Editorial review is explicit, edits revoke it, and paid history or advertising cannot be laundered');
 const cancelledBalance=await balance();await service.cancel(t.id,u.id);assert.equal(await balance(),cancelledBalance);assert.equal((await policy(t.id)).pin,false);assert.equal((await policy(t.id)).policy,'ugc');
 await assert.rejects(pool.query('UPDATE pin_entitlements SET price=1 WHERE id=$1',[original.id]),/immutable/);await assert.rejects(pool.query('DELETE FROM pin_events WHERE entitlement_id=$1',[original.id]),/immutable/);await assert.rejects(pool.query('UPDATE sys_transactions SET amount=0 WHERE id=$1',[original.transaction_id]),/immutable/);
 const correctionKey=key();const correction=await service.correct(original.id,v.id,'Technical test correction with immutable reason',correctionKey);await service.correct(original.id,v.id,'Technical test correction with immutable reason',correctionKey);assert.equal(await balance(),cancelledBalance+10);assert.equal(correction.metadata.originalTransactionId,original.transaction_id);
 pass('Cancellation has no refund; original history immutable; technical correction creates one linked compensating entry');
 // Insert a past-due fixture, without changing an existing purchase or its immutable dates.
 const expired=await newTopic();let expiredId;await atomicWrite(async()=>{const tx=await f.ledger.deduct({userId:u.id,amount:10,currencyCode:'credits',type:'pin_purchase',referenceId:key()});expiredId=key();await db.execute(sql`INSERT INTO pin_entitlements(id,topic_id,user_id,product_id,transaction_id,idempotency_key,payload_hash,price,duration_seconds,balance_before,balance_after,starts_at,ends_at) VALUES(${expiredId}::uuid,${expired.id},${u.id},${plan.id},${tx.id},${key()},'fixture',10,60,${tx.balanceAfter+10},${tx.balanceAfter},clock_timestamp()-interval '120 seconds',clock_timestamp()-interval '60 seconds')`);});
 assert.equal((await policy(expired.id)).pin,false);assert.equal((await policy(expired.id)).policy,'ugc');assert.equal((await rows(sql`SELECT status FROM pin_entitlements WHERE id=${expiredId}::uuid`))[0].status,'active');
 const renewedExpired=await buy(expired);assert(Math.abs(Date.now()-new Date(renewedExpired.starts_at))<5000);
 const runs=await Promise.all([service.expire(),service.expire(),service.expire()]);assert(runs.reduce((a,b)=>a+b,0)>=1);assert.equal(Number((await pool.query("SELECT count(*) AS n FROM pin_events WHERE entitlement_id=$1 AND type='expire'",[expiredId])).rows[0].n),1);
 pass('Past-due active row has no ranking/link privilege before worker; expired renewal starts now; concurrent workers record expiration once');
 await assert.rejects(pool.query('UPDATE sys_accounts SET balance=-1 WHERE user_id=$1',[u.id]),/check constraint/);
 const [shopProduct]=await db.insert(shopItems).values({type:'custom',consumeType:'consumable',name:'Existing Shop race fixture',price:10,currencyCode:'credits',isActive:true}).returning();
 for(const kind of ['buy','gift']){
  const [spender]=await db.insert(users).values({username:'shop_pin_'+kind+'_'+key()}).returning();
  const [st]=await db.insert(topics).values({userId:spender.id,categoryId:cat.id,title:'Mixed Shop and pin race',slug:key(),approvalStatus:'approved'}).returning();await db.insert(posts).values({userId:spender.id,topicId:st.id,postNumber:1,content:'Mixed wallet race',rawContent:'Mixed wallet race',approvalStatus:'approved'});
  await f.ledger.grant({userId:spender.id,amount:15,currencyCode:'credits',type:'test_fixture',referenceId:key()});
  const outcomes=await Promise.allSettled([service.purchase({userId:spender.id,topicId:st.id,productId:plan.id,idempotencyKey:key()}),kind==='buy'?buyItem(spender.id,shopProduct.id):giftItem(spender.id,v.id,shopProduct.id,'Controlled fixture',1)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.ledger.getAccount(spender.id,'credits')).balance,5);
 }
 pass('Existing Shop purchase and gift writers compete safely with paid-pin purchases for the same wallet');

 fs.writeFileSync('docs/audit/PHASE2.3-integration-results.json',JSON.stringify({status:'PASS',database:c.database,checks},null,2)+'\n');
}finally{await pool.end();}
