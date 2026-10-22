import fs from 'node:fs';
import path from 'node:path';
import {config,connect,privateDirectory,root} from './forum.mjs';
import {seededBadges} from '../apps/api/src/extensions/badges/presentation.js';
for(const n of ['a','b']){
  const c=config('forums/forum-'+n+'.json'),d=await connect(c);try{
    const folder=privateDirectory(path.join(root,'.local/badge-cleanup'));
    const file=path.join(folder,'before-'+n+'.json');
    if(!fs.existsSync(file)){
      const snapshot={};
      for(const table of ['users','user_roles','sys_accounts','sys_transactions','seo_purchases','seo_entitlements','seo_events','shop_items','user_items']){
        snapshot[table]=(await d.query(`SELECT id,md5((to_jsonb(t)-'last_seen_at'-'last_login_ip'-'updated_at')::text) AS hash FROM ${table} t ORDER BY id`)).rows;
      }
      fs.writeFileSync(file,JSON.stringify(snapshot));
    }
    let changed=0;await d.query('BEGIN');
    for(const [slug,badge] of Object.entries(seededBadges)){
      const result=await d.query('UPDATE badges SET name=$1,description=$2 WHERE slug=$3 AND name=$4',[badge.name,badge.description,slug,badge.legacyName]);changed+=result.rowCount;
    }
    await d.query('COMMIT');console.log(c.id+': normalized '+changed+' original demo badge labels; custom names, ownership and commerce records preserved');
  }catch(e){await d.query('ROLLBACK');throw e;}finally{await d.end();}
}
