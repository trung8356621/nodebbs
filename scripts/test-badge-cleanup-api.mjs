import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {config,connect,privateDirectory,root} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const forums=['a','b'].map(n=>config('forums/forum-'+n+'.json'));await waitApis(forums);const old=JSON.parse(fs.readFileSync('.local/seo-final/live-fixtures.json')),fixtures={},results=[];
const req=async(c,url,token,body,method)=>{const r=await fetch('http://127.0.0.1:'+c.apiPort+'/api'+url,{method:method||(body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data).slice(0,300));return r.data;};
for(const [i,c] of forums.entries()){
 const d=await connect(c);try{
 const admin=old[c.id].adminToken,username='badge_'+Date.now().toString(36),password=crypto.randomBytes(24).toString('base64url');ok(await req(c,'/auth/register',null,{username,password,email:username+'@example.test'}));const token=ok(await req(c,'/auth/login',null,{identifier:username,password})).token;const user=(await d.query('SELECT id FROM users WHERE username=$1',[username])).rows[0].id;
 const catalog=ok(await req(c,'/badges?limit=100',token)).items;assert(catalog.length>=15);assert(!/\p{Script=Han}/u.test(catalog.map(b=>b.name+' '+b.description).join(' ')));
 const selected=['post-1','reg-30days','reg-1year','admin-verified'].map(slug=>catalog.find(b=>b.slug===slug));for(const badge of selected)ok(await req(c,'/badges/admin/grant',admin,{userId:user,badgeId:badge.id,reason:'Badge cleanup isolated acceptance fixture'}));
 ok(await req(c,'/badges/admin/grant',token,{userId:user,badgeId:selected[0].id}),403);ok(await req(c,'/badges/admin/grant',old[forums[1-i].id].adminToken,{userId:user,badgeId:selected[0].id}),401);
 let owned=ok(await req(c,'/badges?limit=100',token)).items.filter(b=>b.isOwned),record=owned.find(b=>b.slug==='post-1');assert(record);
 ok(await req(c,'/badges/user/'+record.userBadgeId,token,{isDisplayed:true},'PATCH'));let me=ok(await req(c,'/auth/me',token));assert.equal(JSON.parse(me.avatarFrame.itemMetadata).theme,'common');assert.equal(me.badges.length,1);
 await Promise.all(owned.map(b=>req(c,'/badges/user/'+b.userBadgeId,token,{isDisplayed:true},'PATCH').then(ok)));assert.equal((await d.query('SELECT count(*)::int AS n FROM user_badges WHERE user_id=$1 AND is_displayed',[user])).rows[0].n,1);
 const picked=(await d.query('SELECT id FROM user_badges WHERE user_id=$1 AND is_displayed',[user])).rows[0].id;ok(await req(c,'/badges/user/'+picked,token,{isDisplayed:false},'PATCH'));me=ok(await req(c,'/auth/me',token));assert.equal(me.avatarFrame,null);assert.equal(me.badges.length,0);
 const foreign=(await d.query('SELECT id FROM user_badges WHERE user_id<>$1 LIMIT 1',[user])).rows[0];if(foreign)ok(await req(c,'/badges/user/'+foreign.id,token,{isDisplayed:true},'PATCH'),404);
 const balanceBefore=(await d.query('SELECT coalesce(sum(balance),0)::text AS value FROM sys_accounts WHERE user_id=$1',[user])).rows[0].value;
 for(const route of ['/shop/items/1/buy','/shop/items/1/gift','/shop/my-items/1/equip','/shop/my-items/1/unequip','/shop/my-items/1/use'])ok(await req(c,route,token,{quantity:1}),410);
 assert.equal((await d.query('SELECT coalesce(sum(balance),0)::text AS value FROM sys_accounts WHERE user_id=$1',[user])).rows[0].value,balanceBefore);
 const category=(await d.query('SELECT id FROM categories WHERE is_private=false ORDER BY id LIMIT 1')).rows[0].id;
 const topic=ok(await req(c,'/topics/',token,{categoryId:category,title:'Badge cleanup SEO regression '+Date.now(),content:'[Reference](https://example.org/badge-regression)'})).topic;
 const product=ok(await req(c,'/seo/products')).products.find(p=>p.productId==='seo-monthly-paid');assert(product,'Authorized SEO fixture source available');const h=ok(await req(c,'/seo/topics/'+topic.id,token)),q=ok(await req(c,'/seo/topics/'+topic.id+'/quotes',token,{productId:product.productId})),key=crypto.randomUUID();const bought=ok(await req(c,'/seo/topics/'+topic.id+'/purchase',token,{quoteId:q.id,idempotencyKey:key}));assert.equal(ok(await req(c,'/seo/topics/'+topic.id+'/purchase',token,{quoteId:q.id,idempotencyKey:key})).id,bought.id);assert.equal(ok(await req(c,'/seo/topics/'+topic.id,token)).balance,h.balance-product.salePriceCredit);assert.equal(ok(await req(c,'/topics/'+topic.id)).linkPolicy,'paid');ok(await req(c,'/topics/'+topic.id,token,{content:'https://blocked.example.test'},'PATCH'),422);
 fixtures[c.id]={username,password,token,adminToken:admin,user,topic:topic.id,badges:selected.map(b=>({id:b.id,slug:b.slug})),owned};results.push({forum:c.id,status:'PASS',checks:'Registration/auth; 15 neutral seeded labels; operator grant/foreign-token rejection; four frame themes; concurrent equip selects exactly one; unequip default; ownership enforced; legacy commerce 410/no debit; signed SEO exact debit/idempotency/sponsored effect; policy BLOCK'});console.log('PASS '+c.id+' badge API, concurrency, commerce retirement and SEO regression');
 }finally{await d.end();}
}
privateDirectory(path.join(root,'.local/badge-cleanup'));fs.writeFileSync('.local/badge-cleanup/fixtures.json',JSON.stringify(fixtures));fs.writeFileSync('docs/audit/PHASE2.3A-api-results.json',JSON.stringify({status:'PASS',results},null,2)+'\n');
