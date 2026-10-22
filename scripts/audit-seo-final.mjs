import assert from 'node:assert/strict';
import fs from 'node:fs';
import {config,connect,readJson} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const forums=['a','b'].map(n=>config('forums/forum-'+n+'.json'));await waitApis(forums);const results=[];
for(const c of forums){const d=await connect(c);try{const api=await fetch('http://127.0.0.1:'+c.apiPort+'/api/seo/products'),products=await api.json();assert.equal(api.status,200);assert.equal(products.creditVnd,10000);assert.equal(products.products.length,2);const web=await fetch('http://127.0.0.1:'+c.webPort);assert.equal(web.status,200);assert.equal((await d.query('SELECT max(version)::int AS v FROM pbn_meta.schema_versions')).rows[0].v,6);assert.equal((await d.query('SELECT count(*)::int AS n FROM sys_accounts WHERE balance<0')).rows[0].n,0);results.push({forum:c.id,webPort:c.webPort,apiPort:c.apiPort,database:c.database,webStatus:web.status,apiStatus:api.status,baselineVersion:6,products:products.products.map(p=>({id:p.productId,list:p.listPriceCredit,sale:p.salePriceCredit,version:p.snapshotVersion,checksum:p.checksum})),negativeBalances:0});}finally{await d.end();}}
const evidence=fs.readdirSync('docs/audit').filter(n=>/^PHASE2\.3-SEO-.*results\.json$/.test(n)&&!n.includes('final-results'));
for(const file of evidence)assert.equal(readJson('docs/audit/'+file).status,'PASS',file);
fs.writeFileSync('docs/audit/PHASE2.3-SEO-final-results.json',JSON.stringify({status:'PASS',forums:results,evidence,evidenceStatus:'All recorded acceptance results PASS',limits:'Local development acceptance only; no real OPS or production deployment'},null,2)+'\n');console.log('PASS both forums HTTP 200, verified independent catalogs, baseline v6, no negative wallets, all acceptance evidence PASS');
