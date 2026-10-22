import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {config,readJson,connect,stop,start} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const c=config('forums/forum-b.json'),f=readJson('.local/phase23/live-fixtures.json').forum_b;
// Deliberately stall reconciliation, while retaining the normal authoritative read path.
await stop(c);process.env.PBN_PIN_EXPIRE_INTERVAL_MS='3600000';await start(c);await waitApis([c]);
const browser=await chromium.launch({headless:true}),d=await connect(c);const checks=[];
try{
 const context=await browser.newContext();await context.addCookies([{name:'pbn_forum_b_auth',value:f.token,domain:'127.0.0.1',path:'/'},{name:'pbn_forum_b_locale',value:'en-US',domain:'127.0.0.1',path:'/'}]);const page=await context.newPage();const base='http://127.0.0.1:3200',api='http://127.0.0.1:7200/api';await page.goto(base+'/topic/'+f.topic,{waitUntil:'networkidle',timeout:120000});
 const panel=page.getByTestId('paid-pin-panel');await panel.getByRole('button',{name:/Phase23 browser 60 seconds/}).last().click();await panel.getByRole('button',{name:'Confirm payment',exact:true}).click();await page.waitForFunction(()=>document.querySelector('article a[href="https://example.org/research"]')?.rel.includes('sponsored'));
 const receipt=(await d.query('SELECT * FROM pin_entitlements WHERE topic_id=$1 ORDER BY created_at DESC LIMIT 1',[f.topic])).rows[0];
 const nojs=await browser.newContext({javaScriptEnabled:false});const ssr=await nojs.newPage();await ssr.goto(base+'/topic/'+f.topic,{waitUntil:'load',timeout:120000});assert.match(await ssr.locator('article a[href="https://example.org/research"]').getAttribute('rel'),/ugc sponsored/);checks.push('Active paid rel is present in actual server HTML with JavaScript disabled');await nojs.close();
 await panel.screenshot({path:'docs/audit/screenshots/phase23/forum_b-active-before-expiry.png'});console.log('PASS active paid SSR; waiting for real database calendar expiration with worker stalled');
 const remaining=new Date(receipt.ends_at)-Date.now();if(remaining>0)await new Promise(r=>setTimeout(r,remaining+1500));
 await page.waitForFunction(()=>document.querySelector('article a[href="https://example.org/research"]')?.rel.includes('nofollow'),{},{timeout:10000});
 assert.equal((await d.query('SELECT status FROM pin_entitlements WHERE id=$1',[receipt.id])).rows[0].status,'active');checks.push('Open browser downgrades to ugc nofollow at calendar expiration while row remains active and worker is stalled');
 const state=await fetch(api+'/topics/'+f.topic).then(r=>r.json());assert.equal(state.isPinned,false);assert.equal(state.linkPolicy,'ugc');assert.equal(state.pinExpiresAt,null);
 const listing=await fetch(api+'/topics/?isPinned=true').then(r=>r.json());assert(!listing.items.some(t=>t.id===f.topic));checks.push('Fresh API and pinned ranking disregard the past-due active row without reconciliation');
 const expired=await browser.newContext({javaScriptEnabled:false});const ep=await expired.newPage();await ep.goto(base+'/topic/'+f.topic,{waitUntil:'load',timeout:120000});assert.match(await ep.locator('article a[href="https://example.org/research"]').getAttribute('rel'),/ugc nofollow/);await expired.close();checks.push('Fresh no-JavaScript SSR reverts immediately to UGC after expiration');await panel.screenshot({path:'docs/audit/screenshots/phase23/forum_b-expired-worker-stalled.png'});
 const r=await fetch(api+'/pins/admin/reconcile',{method:'POST',headers:{authorization:'Bearer '+f.adminToken,'content-type':'application/json'},body:'{}'});assert.equal(r.status,200);await r.json();assert.equal((await d.query('SELECT status FROM pin_entitlements WHERE id=$1',[receipt.id])).rows[0].status,'expired');
 fs.writeFileSync('docs/audit/PHASE2.3-expiry-browser-results.json',JSON.stringify({status:'PASS',topic:f.topic,entitlement:receipt.id,endsAt:receipt.ends_at,checks},null,2)+'\n');console.log('PASS real-time DOM, no-JS SSR, ranking expiration despite stalled worker; manual reconcile persists once');
}finally{await browser.close();await d.end();await stop(c);delete process.env.PBN_PIN_EXPIRE_INTERVAL_MS;await start(c);await waitApis([c]);}
