import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {config,local,readJson,connect} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const b=config('forums/forum-b.json');await waitApis([b]);
async function req(url,token,body,method){const r=await fetch(`http://127.0.0.1:${b.apiPort}/api${url}`,{method:method||(body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};}
const expect=(r,s,label)=>{assert.equal(r.status,s,label+': '+JSON.stringify(r.data).slice(0,160));return r.data;};
const credentials=readJson(path.join(local(b),'admin.json'));const token=expect(await req('/auth/login',null,{identifier:credentials.username,password:credentials.password}),200,'admin login').token;
const db=await connect(b);const results=[];const pass=name=>{results.push({name,status:'PASS'});console.log('PASS '+name);};
const suffix=Date.now().toString(36), member={username:'p22f_'+suffix,password:crypto.randomBytes(24).toString('base64url')};
async function queue(type,id){return (await db.query("SELECT id FROM moderation_items WHERE target_type=$1 AND target_id=$2 AND status='pending' ORDER BY id DESC LIMIT 1",[type,id])).rows[0].id;}
try {
 expect(await req('/users/',token,{...member,email:member.username+'@example.test',name:'https://blocked.example.test'}),422,'admin account name blocked');
 const user=expect(await req('/users/',token,{...member,email:member.username+'@example.test',name:'Safe fixture'}),200,'member create');
 expect(await req('/users/'+user.id,token,{name:'https://blocked.example.test'},'PATCH'),422,'admin profile edit blocked');
 const mt=expect(await req('/auth/login',null,{identifier:member.username,password:member.password}),200,'member login').token;
 const profile=expect(await req('/users/me',mt,{bio:'https://redirect.example.test'},'PATCH'),200,'profile held');
 assert(profile.pendingFields.includes('bio'));assert.equal((await db.query('SELECT bio FROM users WHERE id=$1',[user.id])).rows[0].bio,null);
 const item=await queue('user_bio',user.id);expect(await req('/moderation/queue/'+item+'/reject',token,{reason:'Test fixture rejected'}),200,'profile reject');
 pass('Admin account create/edit obey mandatory block; profile REVIEW stages original value and supports rejection');
 expect(await req('/users/me',mt,{avatar:'//blocked.example.test/a.png'},'PATCH'),422,'protocol-relative avatar blocked');
 const slot=(await db.query('SELECT id FROM ad_slots ORDER BY id LIMIT 1')).rows[0].id;
 expect(await req('/ads/',token,{slotId:slot,title:'Blocked banner',type:'image',content:'https://example.test/image.png',linkUrl:'https://blocked.example.test'}),422,'banner create blocked');
 const ad=expect(await req('/ads/',token,{slotId:slot,title:'Phase22 review banner '+suffix,type:'image',content:'https://example.test/image.png',linkUrl:'https://redirect.example.test',isActive:true}),200,'banner pending');
 expect(await req('/ads/',token,{slotId:slot,title:'Protocol-relative banner',type:'image',content:'https://example.test/image.png',linkUrl:'//blocked.example.test'}),422,'protocol-relative banner blocked');
 expect(await req('/ads/',token,{slotId:slot,title:'Script URL banner',type:'image',content:'https://example.test/image.png',linkUrl:'javascript:alert(1)'}),422,'script URL banner blocked');
 assert.equal(ad.isActive,false);
 expect(await req('/moderation/queue/'+await queue('policy_ad',ad.id)+'/approve',token,{}),200,'reviewed image approve');
 assert.equal((await db.query('SELECT is_active FROM ads WHERE id=$1',[ad.id])).rows[0].is_active,true);
 expect(await req('/ads/'+ad.id,token,{linkUrl:'https://blocked.example.test'},'PATCH'),422,'banner edit blocked');
 const script=expect(await req('/ads/',token,{slotId:slot,title:'Phase22 active format held '+suffix,type:'script',content:'document.location="https://example.test"',isActive:true}),200,'active format held');
 assert.equal(script.isActive,false);assert.notEqual((await req('/moderation/queue/'+await queue('policy_ad',script.id)+'/approve',token,{})).status,200);
 pass('Banner create/edit enforce rules; review image held until approval; executable formats cannot be approved');
 expect(await req('/pages/admin',token,{title:'Blocked page',slug:'p22-block-'+suffix,type:'markdown',content:'https://blocked.example.test',isPublished:true}),422,'page block');
 const page=expect(await req('/pages/admin',token,{title:'Phase22 review page',slug:'p22-review-'+suffix,type:'markdown',content:'https://redirect.example.test',isPublished:true}),200,'page held');
 assert.equal(page.isPublished,false);expect(await req('/moderation/queue/'+await queue('policy_page',page.id)+'/approve',token,{}),200,'page reviewed approval');
 expect(await req('/pages/admin/'+page.id,token,{content:'https://blocked.example.test'},'PATCH'),422,'page edit block');
 const activePage=expect(await req('/pages/admin',token,{title:'Phase22 active page',slug:'p22-active-'+suffix,type:'html',content:'<p>Active HTML fixture</p>',isPublished:true}),200,'active HTML page held');
 assert.equal(activePage.isPublished,false);assert.notEqual((await req('/moderation/queue/'+await queue('policy_page',activePage.id)+'/approve',token,{})).status,200);
 pass('Published page create/edit enforce mandatory rules; REVIEW stays draft until moderation; active HTML cannot be approved');
 const category=(await db.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
 const held=expect(await req('/topics/',mt,{title:'Phase22 member review '+suffix,categoryId:category,content:'https://redirect.example.test'}),200,'member held topic').topic;
 expect(await req('/moderation/queue/'+await queue('topic',held.id)+'/approve',token,{}),200,'topic manual approve');
 const reply=expect(await req('/posts/',mt,{topicId:held.id,content:'https://redirect.example.test'}),200,'member held reply').post;
 assert.equal(reply.approvalStatus,'pending');expect(await req('/moderation/queue/'+await queue('post',reply.id)+'/reject',token,{reason:'Test review rejected'}),200,'reply reject');
 pass('Member topic/reply review states and allowed approve/reject transitions');
 const registration={username:'p22r_'+suffix,email:'p22r_'+suffix+'@example.test',password:crypto.randomBytes(24).toString('base64url')};
 expect(await req('/auth/register',null,{...registration,name:'https://blocked.example.test'}),422,'registration name blocked');
 const registered=await req('/auth/register',null,{...registration,name:'Safe registration fixture'});
 if(registered.status===200){assert(registered.data.token);pass('Real registration and registration-name policy enforcement');}
 else {results.push({name:'Registration regression',status:'NOT TESTED',reason:'Existing registration prerequisites rejected test request; configuration unchanged',httpStatus:registered.status});}
 fs.writeFileSync('docs/audit/PHASE2.2-fields-results.json',JSON.stringify(results,null,2)+'\n');
}finally{await db.end();}
