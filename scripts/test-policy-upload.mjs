import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {config,local,readJson,connect,api} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const c=config('forums/forum-b.json');await waitApis([c]);
const base=`http://127.0.0.1:${c.apiPort}`;
const credentials=readJson(path.join(local(c),'admin.json'));
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:credentials.username,password:credentials.password})});assert.equal(login.status,200);const {token}=await login.json();
const headers={authorization:'Bearer '+token};const db=await connect(c);
const json=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const before=(await db.query('SELECT count(*)::int AS n FROM files')).rows[0].n;
try{
 for(const [filename,type,text] of [['bypass.html','text/html','<a href="https://blocked.example.test">x</a>'],['bypass.svg','image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg"><a href="https://blocked.example.test"><text>x</text></a></svg>']]) {
  const form=new FormData();form.set('file',new Blob([text],{type}),filename);const upload=await fetch(base+'/api/upload/?category=assets',{method:'POST',headers,body:form});assert.equal(upload.status,422);assert.equal((await upload.json()).code,'POLICY_BLOCKED');
  assert.equal((await json('/api/upload/presign',{filename,mimetype:type,size:text.length,category:'assets'})).status,422);
  const saved=crypto.randomUUID()+'.'+filename.split('.').at(-1);
  assert.equal((await json('/api/upload/confirm',{key:'assets/'+saved,filename:saved,originalName:filename,mimetype:type,size:text.length,category:'assets',provider:'local'})).status,422);
 }
 assert.equal((await db.query('SELECT count(*)::int AS n FROM files')).rows[0].n,before);
 const sharp=createRequire(api+'/package.json')('sharp');
 const png=await sharp({create:{width:2,height:2,channels:4,background:{r:0,g:120,b:255,alpha:1}}}).png().toBuffer();
 const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),'phase22-raster.png');const response=await fetch(base+'/api/upload/?category=assets',{method:'POST',headers,body:form});assert.equal(response.status,200);const uploaded=await response.json();
 const served=await fetch(base+uploaded.url);assert.equal(served.status,200);assert.equal(served.headers.get('x-content-type-options'),'nosniff');
 const records=(await db.query("SELECT count(*)::int AS n FROM policy_decisions WHERE content_type='upload' AND action='BLOCK'")).rows[0].n;assert(records>=6);
 fs.writeFileSync('docs/audit/PHASE2.2-upload-results.json',JSON.stringify({status:'PASS',checks:['Admin HTML/SVG multipart uploads rejected','Active markup presign/confirm rejected','Blocked uploads create no file records','Six rejected paths audited','Raster PNG multipart/static serve works with nosniff'],blockedAudits:records},null,2)+'\n');
 console.log('PASS: multipart/presign/confirm HTML/SVG bypasses blocked and audited; no partial file records; PNG regression passes');
}finally{await db.end();}
