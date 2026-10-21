import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { root,api,config,local,runtime,connect,readJson,writeJson,sha,migrate,start,stop } from './forum.mjs';

const require = createRequire(path.join(api,'package.json'));
const Redis = require('ioredis');
const a=config('forums/forum-a.json'), b=config('forums/forum-b.json');
assert.equal(a.database,'pbn_dev');assert.equal(b.database,'pbn_forum_b');
const results={date:new Date().toISOString(),checks:[],fixtures:{},limitations:[]};
const record=(name,detail)=>{results.checks.push({name,pass:true,...detail});console.log('PASS '+name);};
const url=(c,web=false)=>`http://${c.hostname}:${web?c.webPort:c.apiPort}`;
async function req(c,route,{token,cookie,body,method,headers={},web=false,raw=false}={}) {
  if(headers.host) return await new Promise((resolve,reject)=>{
    const request=http.get({hostname:c.hostname,port:web?c.webPort:c.apiPort,path:route,headers},response=>{
      let text='';response.setEncoding('utf8');response.on('data',part=>text+=part);
      response.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:response.statusCode,text,data,headers:new Headers(response.headers)});});
    });request.on('error',reject);
  });
  const response=await fetch(url(c,web)+route,{method:method || (body?'POST':'GET'),headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(cookie?{cookie}:{}),...(body && !(body instanceof FormData)?{'content-type':'application/json'}:{}),...headers},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(120000),redirect:'manual'});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data,text,headers:response.headers};
}
function status(response,expected,name){assert.equal(response.status,expected,`${name}: HTTP ${response.status} ${typeof response.data==='string'?response.data.slice(0,100):JSON.stringify(response.data).slice(0,180)}`);return response;}
async function login(c,credentials){const r=status(await req(c,'/api/auth/login',{body:{identifier:credentials.username,password:credentials.password}}),200,'Login '+c.id);assert(r.data.token);return r;}
async function wait(c,web=false){const end=Date.now()+180000;while(Date.now()<end){try{const r=await req(c,web?'/':'/api',{web});if(r.status===200)return r;}catch{}await new Promise(r=>setTimeout(r,1000));}throw new Error('Runtime unavailable: '+c.id);}
async function counts(client){const names=['users','topics','posts','categories','sys_accounts','sys_transactions','ads','files','user_roles'];const out={};for(const name of names)out[name]=Number((await client.query(`SELECT count(*) FROM ${name}`)).rows[0].count);return out;}
async function main(){
  const dbA=await connect(a),dbB=await connect(b);
  const redisA=new Redis(runtime(a).REDIS_URL,{keyPrefix:runtime(a).REDIS_KEY_PREFIX});
  const redisB=new Redis(runtime(b).REDIS_URL,{keyPrefix:runtime(b).REDIS_KEY_PREFIX});
  const rawRedis=new Redis(runtime(b).REDIS_URL);
  let browser;
  try{
    const before=await counts(dbA);
    const ownerBefore=(await dbA.query('SELECT password_hash FROM users WHERE id=7')).rows[0].password_hash;
    for(const c of [a,b]){await wait(c);record(c.id+' API health');const home=await wait(c,true);assert(home.text.includes(`lang="${c.locale}"`));assert(home.text.includes(`--primary:${c.primaryColor}`));record(c.id+' homepage/locale/theme',{status:home.status,locale:c.locale,color:c.primaryColor});}
    const credentialsA={username:'trungtien1993',password:execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8'}).trim()};
    const credentialsB=readJson(path.join(local(b),'admin.json'));
    const la=await login(a,credentialsA),lb=await login(b,credentialsB);
    const ta=la.data.token,tb=lb.data.token;
    for(const [c,r] of [[a,la],[b,lb]]){assert(r.headers.get('set-cookie').startsWith(`pbn_${c.id}_auth=`));assert(!/; Domain=/i.test(r.headers.get('set-cookie')));status(await req(c,'/api/dashboard/stats',{token:r.data.token}),200,'Own admin');}
    record('Independent Admin login and host-only cookie names');
    for(const [source,target,token,credentials] of [[a,b,ta,credentialsA],[b,a,tb,credentialsB]]){
      status(await req(target,'/api/auth/login',{body:{identifier:credentials.username,password:credentials.password}}),401,'Foreign credentials');
      for(const route of ['/api/auth/me','/api/dashboard/stats','/api/roles','/api/ledger/accounts']){
        status(await req(target,route,{token}),401,'Foreign bearer');
        status(await req(target,route,{cookie:`pbn_${target.id}_auth=${token}`}),401,'Renamed foreign cookie');
      }
      status(await req(target,'/api/users/',{token,body:{username:'forbidden_cross',email:'forbidden@example.test',password:crypto.randomBytes(20).toString('hex')}}),401,'Foreign write');
      status(await req(target,'/api/topics/1',{token,method:'PATCH',body:{title:'FORBIDDEN CROSS WRITE'}}),401,'Foreign topic mutation');
    }
    record('Cross-forum credentials/bearer/cookie/admin/ledger/write rejection both directions');
    status(await req(b,'/api/auth/me',{cookie:`pbn_${a.id}_auth=${ta}`}),401,'A cookie ignored by B');
    status(await req(a,'/api/auth/me',{cookie:`pbn_${b.id}_auth=${tb}`}),401,'B cookie ignored by A');
    const cookies=`pbn_${a.id}_auth=${ta}; pbn_${b.id}_auth=${tb}`;
    assert.equal(status(await req(a,'/api/auth/me',{cookie:cookies}),200,'Both cookies A').data.username,credentialsA.username);
    assert.equal(status(await req(b,'/api/auth/me',{cookie:cookies}),200,'Both cookies B').data.username,credentialsB.username);
    record('Two cookies on same IP select only the correct forum session');
    for(const c of [a,b]){
      status(await req(c,'/api',{headers:{host:'unknown.example.test'}}),421,'Unknown API host');
      status(await req(c,'/',{web:true,headers:{host:'unknown.example.test'}}),421,'Unknown Web host');
    }
    status(await req(b,'/api/auth/login',{body:{identifier:credentialsB.username,password:credentialsB.password},headers:{origin:url(a,true)}}),403,'Foreign origin');
    record('Unknown hosts and foreign browser Origin fail closed');
    const prior=readJson(path.join(local(a),'pre-phase21b.json'));
    await migrate(b);assert.deepEqual(await counts(dbA),before);
    assert.deepEqual((await dbA.query('SELECT * FROM drizzle.__drizzle_migrations')).rows,prior.migrations);
    record('Rerun Forum B baseline leaves Forum A counts/history unchanged');
    const suffix=Date.now().toString(36);
    const member={username:'b_member_'+suffix,password:crypto.randomBytes(24).toString('base64url')};
    const user=status(await req(b,'/api/users/',{token:tb,body:{...member,email:member.username+'@example.test'}}),200,'Create B user').data;
    const category=Number((await dbB.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id);
    const title='Forum B isolated topic '+suffix;
    const topic=status(await req(b,'/api/topics/',{token:tb,body:{title,categoryId:category,content:'Forum B original post '+suffix}}),200,'Create B topic').data.topic;
    const post=status(await req(b,'/api/posts/',{token:tb,body:{topicId:topic.id,content:'Forum B comment '+suffix}}),200,'Create B comment').data;
    status(await req(b,`/api/topics/${topic.id}`,{token:tb,method:'PATCH',body:{isPinned:true}}),200,'Pin B topic');
    results.fixtures={user:user.id,username:user.username,topic:topic.id,title,comment:post.id};
    assert.equal((await dbA.query('SELECT 1 FROM users WHERE username=$1',[member.username])).rowCount,0);
    assert.equal((await dbA.query('SELECT 1 FROM topics WHERE title=$1',[title])).rowCount,0);
    assert.equal((await dbB.query('SELECT 1 FROM users WHERE username=$1',[credentialsA.username])).rowCount,0);
    const aTopic=(await dbA.query('SELECT title FROM topics ORDER BY id DESC LIMIT 1')).rows[0].title;
    assert.equal((await dbB.query('SELECT 1 FROM topics WHERE title=$1',[aTopic])).rowCount,0);
    status(await req(b,'/api/users/'+credentialsA.username),404,'A user invisible B API');
    status(await req(a,'/api/users/'+member.username),404,'B user invisible A API');
    const aTopics=await req(a,'/api/topics/'),bTopics=await req(b,'/api/topics/');
    assert(!aTopics.text.includes(title));assert(bTopics.text.includes(title));assert(!bTopics.text.includes(aTopic));
    record('User/topic isolation both directions; B user/topic/comment/pin API writes verified in B only');
    // Deliberately overlap A's owner numeric ID with a non-admin member in B.
    const colliding={username:'b_collision_seven',password:crypto.randomBytes(24).toString('base64url')};
    const bcrypt=require('bcryptjs');
    if(!(await dbB.query('SELECT 1 FROM users WHERE id=7')).rowCount){
      await dbB.query("INSERT INTO users(id,username,email,password_hash,role) OVERRIDING SYSTEM VALUE VALUES(7,$1,$2,$3,'user')",[colliding.username,colliding.username+'@example.test',await bcrypt.hash(colliding.password,10)]);
      await dbB.query("INSERT INTO user_roles(user_id,role_id) SELECT 7,id FROM roles WHERE slug='user'");
      await dbB.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users))");
      writeJson(path.join(local(b),'collision-user.json'),colliding);
    }
    const collisionLogin=await login(b,readJson(path.join(local(b),'collision-user.json')));
    status(await req(a,'/api/auth/me',{token:ta}),200,'A user cache');
    status(await req(b,'/api/auth/me',{token:collisionLogin.data.token}),200,'B user cache');
    status(await req(b,'/api/dashboard/stats',{token:collisionLogin.data.token}),403,'B member cannot admin');
    const ca=JSON.parse(await rawRedis.get('pbn:forum_a:user:7')),cb=JSON.parse(await rawRedis.get('pbn:forum_b:user:7'));
    assert.equal(ca.username,credentialsA.username);assert.equal(cb.username,colliding.username);
    await redisA.set('isolation:sentinel','forum_a','EX',300);await redisB.set('isolation:sentinel','forum_b','EX',300);
    assert.equal(await redisA.get('isolation:sentinel'),'forum_a');assert.equal(await redisB.get('isolation:sentinel'),'forum_b');
    record('Real auth/RBAC caches isolated with colliding user ID 7; Redis prefixes independent');
    // Real image upload uses forum-specific staging, provider storage and file table.
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
    const form=new FormData();form.append('file',new Blob([image],{type:'image/png'}),'isolation.png');
    const upload=status(await req(b,'/api/upload/?category=assets',{token:tb,body:form}),200,'Upload B').data;
    assert(fs.existsSync(path.join(runtime(b).UPLOAD_ROOT,upload.url.replace('/uploads/',''))));
    assert(!fs.existsSync(path.join(runtime(a).UPLOAD_ROOT,upload.url.replace('/uploads/',''))));
    status(await req(b,upload.url),200,'B media own');status(await req(a,upload.url),404,'B media absent A');
    status(await req(b,upload.url,{web:true}),200,'B proxy media');status(await req(a,upload.url,{web:true}),404,'A proxy cannot B media');
    assert.equal((await dbA.query('SELECT 1 FROM files WHERE filename=$1',[upload.filename])).rowCount,0);
    results.fixtures.upload=upload.url;
    record('Real multipart upload/provider/staging/static/proxy/file-row isolation');
    // Existing wallet and banner schemas, fixtures only, no new business logic.
    await dbB.query('BEGIN');
    try{
      const account=(await dbB.query("INSERT INTO sys_accounts(user_id,currency_code,balance,total_earned) VALUES($1,'gold',4321,4321) ON CONFLICT(user_id,currency_code) DO UPDATE SET balance=4321,total_earned=4321 RETURNING id",[user.id])).rows[0];
      await dbB.query("INSERT INTO sys_transactions(user_id,account_id,currency_code,amount,balance_after,type,description) VALUES($1,$2,'gold',4321,4321,'grant','Portable fixture')",[user.id,account.id]);
      const slot=(await dbB.query("SELECT id FROM ad_slots WHERE code='home_header_banner'")).rows[0];
      await dbB.query("INSERT INTO ads(slot_id,title,type,content,is_active) VALUES($1,'Portable Forum B banner','image',$2,true)",[slot.id,upload.url]);
      await dbB.query('COMMIT');
    }catch(e){await dbB.query('ROLLBACK');throw e;}
    record('Portable wallet/transaction/banner fixtures present; pinned topic and comment persisted');
    const settingsA=status(await req(a,'/api/settings'),200,'Settings A').data,settingsB=status(await req(b,'/api/settings'),200,'Settings B').data;
    assert.equal(settingsB.site_name.value,b.name);assert.notEqual(settingsA.site_name.value,settingsB.site_name.value);
    record('Forum names/settings independent',{a:settingsA.site_name.value,b:settingsB.site_name.value});
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    fs.mkdirSync(path.join(root,'docs/audit/screenshots/phase21b'),{recursive:true});
    for(const c of [a,b]){
      const response=await page.goto(url(c,true),{waitUntil:'networkidle',timeout:120000});assert.equal(response.status(),200);
      assert.equal(await page.locator('html').getAttribute('lang'),c.locale);
      assert.equal(await page.locator('html').evaluate(el=>el.style.getPropertyValue('--primary')),c.primaryColor);
      await page.screenshot({path:path.join(root,`docs/audit/screenshots/phase21b/${c.id}-home.png`),fullPage:false});
    }
    const aCookie=`pbn_${a.id}_auth=${ta}`;
    const bCookie=`pbn_${b.id}_auth=${tb}`;
    assert.equal((await context.request.get(url(b,true)+'/api/auth/me',{headers:{cookie:aCookie}})).status(),401);
    assert.equal((await context.request.get(url(a,true)+'/api/auth/me',{headers:{cookie:bCookie}})).status(),401);
    const crossDashboard=await context.request.get(url(b,true)+'/dashboard',{headers:{cookie:aCookie}});
    const crossText=await crossDashboard.text();assert(!crossText.includes(credentialsA.username));
    // Login through B's real form; A stays anonymous in the same browser context.
    await page.goto(url(b,true)+'/auth/login',{waitUntil:'networkidle',timeout:120000});
    const formLogin=page.locator('form').filter({has:page.locator('input[name="identifier"]')}).first();
    await formLogin.locator('input[name="identifier"]').fill(credentialsB.username);
    await formLogin.locator('input[name="password"]').fill(credentialsB.password);
    await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.status()===200),formLogin.locator('button[type="submit"]').click()]);
    await page.goto(url(b,true)+'/dashboard',{waitUntil:'networkidle',timeout:120000});assert.equal(page.url(),url(b,true)+'/dashboard');
    await page.screenshot({path:path.join(root,'docs/audit/screenshots/phase21b/forum_b-dashboard.png'),fullPage:false});
    await page.goto(url(a,true)+'/dashboard',{waitUntil:'networkidle',timeout:120000});assert.notEqual(page.url(),url(a,true)+'/dashboard');
    assert.equal(errors.length,0,'Browser page errors: '+errors.join('; '));
    record('Browser homepages, B form login/Admin, A dashboard denied with B session, proxy/SSR cross-cookie checks');
    await browser.close();browser=null;
    const stateA=readJson(path.join(local(a),'processes.json'));
    const availability=[];
    let monitoring=true;
    const monitor=(async()=>{while(monitoring){try{availability.push((await req(a,'/api',{token:ta})).status);}catch{availability.push(0);}await new Promise(r=>setTimeout(r,250));}})();
    try { stop(b);await wait(a);await start(b);await wait(b);await wait(b,true); } finally { monitoring=false;await monitor; }
    assert(availability.length>0&&availability.every(s=>s===200));assert.deepEqual(readJson(path.join(local(a),'processes.json')),stateA);
    record('Restart B keeps A process IDs and API availability',{samples:availability.length,statuses:[...new Set(availability)]});
    assert.deepEqual(await counts(dbA),before);
    assert.equal((await dbA.query('SELECT password_hash FROM users WHERE id=7')).rows[0].password_hash,ownerBefore);
    const ownerRole=(await dbA.query("SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=7 AND r.slug='admin'")).rowCount;assert.equal(ownerRole,1);
    record('Forum A business row counts, owner password hash and RBAC preserved',{counts:before});
    writeJson(path.join(local(b),'isolation-fixtures.json'),results.fixtures);
  }finally{if(browser)await browser.close();await Promise.all([dbA.end(),dbB.end(),redisA.quit(),redisB.quit(),rawRedis.quit()]);}
}
try{await main();results.pass=true;}catch(e){results.pass=false;results.failure=e.message;console.error('FAIL '+e.message);process.exitCode=1;}
writeJson(path.join(root,'.local/phase21b-isolation.json'),results);
// The public evidence contains no passwords, cookies, tokens or connection strings.
writeJson(path.join(root,'docs/audit/PHASE2.1B-test-results.json'),results);
