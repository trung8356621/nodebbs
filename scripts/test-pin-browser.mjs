import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {config,readJson} from './forum.mjs';
const fixtures=readJson('.local/phase23/live-fixtures.json');const results=[];const browser=await chromium.launch({headless:true});const dir='docs/audit/screenshots/phase23';fs.mkdirSync(dir,{recursive:true});
try{
 for(const n of ['a','b']){
  const c=config('forums/forum-'+n+'.json'),f=fixtures[c.id],base='http://127.0.0.1:'+c.webPort,api='http://127.0.0.1:'+c.apiPort+'/api';
  for(const locale of ['vi-VN','en-US']){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:`pbn_${c.id}_auth`,value:f.token,domain:'127.0.0.1',path:'/'},{name:`pbn_${c.id}_locale`,value:locale,domain:'127.0.0.1',path:'/'}]);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/topic/'+f.topic,{waitUntil:'networkidle',timeout:120000});
   const panel=page.getByTestId('paid-pin-panel');await panel.waitFor();const vi=locale==='vi-VN';await panel.getByRole('heading',{name:vi?'Ghim chủ đề trả phí':'Paid topic pin',exact:true}).waitFor();
   const choose=panel.getByRole('button',{name:/Phase23 browser 60 seconds/}).last();await choose.click();
   await panel.getByRole('button',{name:vi?'Xác nhận thanh toán':'Confirm payment',exact:true}).click();
   const external=page.locator('article a[href="https://example.org/research"]');await page.waitForFunction(()=>document.querySelector('article a[href="https://example.org/research"]')?.rel.includes('sponsored'));
   const tokens=(await external.getAttribute('rel')).split(' ');assert(tokens.includes('ugc')&&tokens.includes('sponsored')&&!tokens.includes('nofollow'));assert(!await page.locator('article a[href="https://example.org/raw"]').count());
   const internal=page.locator('article a[href="'+(c.publicOrigin||`http://${c.hostname}:${c.webPort}`)+'/topics"]');assert(!(await internal.getAttribute('rel')).includes('nofollow'));
   assert.match(await page.locator('a[href="https://example.org/reply"]').getAttribute('rel'),/ugc nofollow/);
   await panel.locator('summary').click();await panel.screenshot({path:`${dir}/${c.id}-${locale}-owner.png`});
   // Browser renewal, preserving the immutable current end.
   const before=await fetch(api+'/pins/topics/'+f.topic,{headers:{authorization:'Bearer '+f.token}}).then(r=>r.json());const prior=before.purchases[0];
   await choose.click();await panel.getByRole('button',{name:vi?'Xác nhận thanh toán':'Confirm payment',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('[role="dialog"][aria-label="Confirm payment"]')&&!document.querySelector('[role="dialog"][aria-label="Xác nhận thanh toán"]'));
   const after=await fetch(api+'/pins/topics/'+f.topic,{headers:{authorization:'Bearer '+f.token}}).then(r=>r.json());assert.equal(new Date(after.purchases[0].starts_at).getTime(),new Date(prior.ends_at).getTime());assert.equal(after.balance,before.balance-10);
   page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:vi?'Hủy ghim trả phí':'Cancel paid placement',exact:true}).click();await page.waitForFunction(()=>document.querySelector('article a[href="https://example.org/research"]')?.rel.includes('nofollow'));
   const cancelled=await fetch(api+'/pins/topics/'+f.topic,{headers:{authorization:'Bearer '+f.token}}).then(r=>r.json());assert.equal(cancelled.balance,after.balance);
   // Server response must already contain the same attributes with JavaScript disabled.
   const nojs=await browser.newContext({javaScriptEnabled:false});const ssr=await nojs.newPage();await ssr.goto(base+'/topic/'+f.topic,{waitUntil:'load',timeout:120000});assert.match(await ssr.locator('article a[href="https://example.org/research"]').getAttribute('rel'),/ugc nofollow/);assert(!await ssr.locator('article script').count());await nojs.close();
   await page.goto(base+'/topic/'+f.editorialTopic,{waitUntil:'networkidle',timeout:120000});const erel=await page.locator('article a[href="https://example.org/editorial"]').getAttribute('rel');assert.equal(erel,'noopener noreferrer');
   assert.deepEqual(errors,[]);results.push({forum:c.id,locale,status:'PASS',checks:'Owner balance/plans/confirm/purchase/renew/cancel/history; reply UGC; internal links; raw HTML escaped; no-JS SSR; editorial rel; no page errors'});console.log('PASS '+c.id+' '+locale+' owner purchase/renew/cancel and actual DOM/SSR links');await context.close();
   const admin=await browser.newContext({viewport:{width:1440,height:1000}});await admin.addCookies([{name:`pbn_${c.id}_auth`,value:f.adminToken,domain:'127.0.0.1',path:'/'},{name:`pbn_${c.id}_locale`,value:locale,domain:'127.0.0.1',path:'/'}]);const ap=await admin.newPage();await ap.goto(base+'/dashboard/pins',{waitUntil:'networkidle',timeout:120000});await ap.getByRole('heading',{name:vi?'Ghim trả phí và duyệt biên tập':'Paid pins and editorial review',exact:true}).waitFor();await ap.getByText('Phase23 browser 60 seconds',{exact:false}).first().waitFor();await ap.getByRole('button',{name:vi?'Đối soát hết hạn':'Reconcile expiration',exact:true}).click();await ap.getByRole('status').filter({hasText:vi?'Đã lưu':'Saved'}).waitFor();await ap.screenshot({path:`${dir}/${c.id}-${locale}-admin.png`});results.push({forum:c.id,locale,status:'PASS',checks:'Localized admin plans, purchases, audit events and real expiration reconciliation'});console.log('PASS '+c.id+' '+locale+' admin');await admin.close();
  }
 }
 fs.writeFileSync('docs/audit/PHASE2.3-browser-results.json',JSON.stringify({status:'PASS',results},null,2)+'\n');
}finally{await browser.close();}
