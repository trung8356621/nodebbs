import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {readJson,config} from './forum.mjs';
const c=config('forums/forum-b.json'),f=readJson('.local/seo-final/live-fixtures.json').forum_b,api='http://127.0.0.1:7200/api';const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();await context.addCookies([{name:'pbn_forum_b_auth',value:f.token,domain:'127.0.0.1',path:'/'},{name:'pbn_forum_b_locale',value:'en-US',domain:'127.0.0.1',path:'/'}]);const page=await context.newPage();let lost=false;
 const state=async()=>{for(let i=0;i<3;i++){const r=await fetch(api+'/seo/topics/'+f.paidTopic,{headers:{authorization:'Bearer '+f.token}});const data=await r.json();if(r.status===429){await new Promise(resolve=>setTimeout(resolve,Math.min(60000,Math.max(1000,new Date(data.resetTime)-Date.now()+100))));continue;}assert.equal(r.status,200);return data;}throw new Error('Rate limit did not clear');};const before=await state();
 await page.route('**/api/seo/topics/'+f.paidTopic+'/purchase',async route=>{if(!lost){const response=await route.fetch();assert.equal(response.status(),200);lost=true;await route.abort('failed');}else await route.continue();});
 await page.goto('http://127.0.0.1:3200/topic/'+f.paidTopic,{waitUntil:'networkidle',timeout:120000});let panel=page.getByTestId('seo-panel');await panel.getByRole('button',{name:'Purchase / renew SEO',exact:true}).last().click();await panel.getByRole('button',{name:'Confirm SEO activation',exact:true}).click();await panel.getByRole('status').filter({hasText:'Action failed'}).waitFor();assert(lost);
 const committed=await state();assert.equal(committed.purchases.length,before.purchases.length+1);
 await page.reload({waitUntil:'networkidle'});panel=page.getByTestId('seo-panel');await panel.getByRole('button',{name:'Purchase / renew SEO',exact:true}).last().click();await panel.getByRole('button',{name:'Confirm SEO activation',exact:true}).click();await panel.getByRole('status').filter({hasText:'Saved'}).waitFor();const retried=await state();assert.equal(retried.purchases.length,committed.purchases.length);assert.equal(retried.balance,committed.balance);assert.equal(retried.purchases[0].id,committed.purchases[0].id);
 await fetch(api+'/seo/topics/'+f.paidTopic+'/cancel',{method:'POST',headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},body:'{}'});
 fs.writeFileSync('docs/audit/PHASE2.3-SEO-browser-retry-results.json',JSON.stringify({status:'PASS',checks:['Browser response lost after durable upstream purchase','Reload and reselect reused the persisted forum/user/topic operation key','Explicit retry returned the same purchase without debit or duration duplication']},null,2)+'\n');console.log('PASS browser lost-response → reload → confirmed retry creates no duplicate charge or duration');
}finally{await browser.close();}
