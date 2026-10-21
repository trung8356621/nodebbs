import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {config,root,local,readJson} from './forum.mjs';
const results=[];const browser=await chromium.launch({headless:true});
try{
 for(const name of ['a','b']) {
  const c=config('forums/forum-'+name+'.json');
  const credentials=name==='a'?{username:'trungtien1993',password:execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8',windowsHide:true}).trim()}:readJson(path.join(local(c),'admin.json'));
  const r=await fetch(`http://127.0.0.1:${c.apiPort}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:credentials.username,password:credentials.password})});assert.equal(r.status,200);const {token}=await r.json();
  for(const locale of ['vi-VN','en-US']) {
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.addCookies([{name:`pbn_${c.id}_auth`,value:token,domain:'127.0.0.1',path:'/'},{name:`pbn_${c.id}_locale`,value:locale,domain:'127.0.0.1',path:'/'}]);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${c.webPort}/dashboard/policy`,{waitUntil:'networkidle',timeout:120000});
   const title=locale==='vi-VN'?'Chính sách nội dung':'Content policy';await page.getByRole('heading',{name:title,exact:true}).waitFor();
   await page.getByText('blocked.example.test',{exact:true}).waitFor();
   assert(!await page.getByText('No verified snapshot configured',{exact:true}).count());
   if(name==='b' && locale==='en-US') {
    const domain='browser-'+Date.now().toString(36)+'.example.test';
    await page.getByRole('button',{name:'Add rule',exact:true}).click();
    await page.getByLabel('Value',{exact:true}).fill(domain);await page.getByLabel('Reason',{exact:true}).fill('Phase22 browser fixture');
    await page.getByRole('button',{name:'Save rule',exact:true}).click();await page.getByText(domain,{exact:true}).waitFor();
    await page.getByLabel('Search rules',{exact:true}).fill(domain);
    await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Enabled',{exact:true}).uncheck();await page.getByRole('button',{name:'Save rule',exact:true}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).waitFor();
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByText(domain,{exact:true}).waitFor({state:'detached'});
   }
   await page.getByLabel(locale==='vi-VN'?'Tìm quy tắc':'Search rules',{exact:true}).fill('');
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.waitForFunction(()=>document.querySelectorAll('[data-sonner-toast]').length===0);
   assert.deepEqual(errors,[]);
   const dir='docs/audit/screenshots/phase22';fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/${c.id}-${locale}-policy.png`});
   results.push({forum:c.id,locale,status:'PASS',checks:'Translated policy page, verified global rules, no browser errors'+(name==='b'&&locale==='en-US'?'; real local-rule create/edit/disable/search/delete':'')});
   console.log('PASS '+c.id+' '+locale+' policy browser');await context.close();
  }
 }
 fs.writeFileSync('docs/audit/PHASE2.2-browser-results.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
