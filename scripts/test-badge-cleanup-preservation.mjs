import assert from 'node:assert/strict';
import fs from 'node:fs';
import {config,connect,runtime,readJson} from './forum.mjs';
import {presentBadge} from '../apps/api/src/extensions/badges/presentation.js';
const results=[];
for(const n of ['a','b']){
 const c=config('forums/forum-'+n+'.json'),d=await connect(c),before=readJson('.local/badge-cleanup/before-'+n+'.json');try{
 for(const [table,original] of Object.entries(before)){const after=(await d.query(`SELECT id,md5((to_jsonb(t)-'last_seen_at'-'last_login_ip'-'updated_at')::text) AS hash FROM ${table} t WHERE id=ANY($1) ORDER BY id`,[original.map(r=>r.id)])).rows;assert.deepEqual(after,original,'Preserve original '+c.id+' '+table);}
 assert.equal((await d.query('SELECT max(version)::int AS version FROM pbn_meta.schema_versions')).rows[0].version,6);
 const r=await fetch('http://127.0.0.1:'+c.apiPort+'/api/shop/items');assert.equal(r.status,200);assert.equal((await r.json()).commerceEnabled,false);
 results.push({forum:c.id,status:'PASS',protectedTables:Object.keys(before),baselineVersion:6,checks:'Original users/roles, wallets/ledger, SEO purchases/terms/events, shop definitions and inventory preserved; only authentication/update timestamps excluded; no schema change; public decoration catalog explicitly unavailable'});
 }finally{await d.end();}
}
assert.equal(presentBadge({slug:'custom',name:'Custom',metadata:'bad JSON'}).frameTheme,'common');
assert.equal(presentBadge({slug:'custom',name:'Custom',metadata:JSON.stringify({frameTheme:'premium'})}).frameTheme,'premium');
assert.equal(presentBadge({slug:'custom',name:'Custom',metadata:JSON.stringify({rarity:'epic'})}).frameTheme,'premium');
Object.assign(process.env,runtime(config('forums/forum-a.json')));
const service=await import('../apps/api/src/extensions/shop/services/shopService.js');const {pool}=await import('../apps/api/src/db/index.js');try{for(const fn of ['buyItem','giftItem','equipItem','unequipItem','useItem'])await assert.rejects(service[fn](1,1,1),e=>e.statusCode===410);}finally{await pool.end();}
fs.writeFileSync('docs/audit/PHASE2.3A-preservation-results.json',JSON.stringify({status:'PASS',results,serviceGuards:'Direct buy/gift/equip/unequip/use entry points reject before database writes',frameMetadata:'Invalid metadata safe; custom metadata enum and rarity mapping verified'},null,2)+'\n');console.log('PASS original A/B account/commercial records preserved, direct service guards, safe frame metadata and unchanged baseline v6');
