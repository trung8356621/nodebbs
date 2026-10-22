import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {config,root,local,readJson,writeJson,privateDirectory,runtime} from './forum.mjs';
for(const name of ['a','b']){
 const c=config('forums/forum-'+name+'.json'),dir=privateDirectory(path.join(root,'.local/seo-final/ops',c.id));
 const secret=path.join(dir,'signing-private.pem'),trust=path.join(dir,'trust-public.pem'),snapshot=path.join(dir,'prices.json');
 if(!fs.existsSync(secret)){const keys=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(secret,keys.privateKey.export({type:'pkcs8',format:'pem'}));fs.writeFileSync(trust,keys.publicKey.export({type:'spki',format:'pem'}));}
 if(!fs.existsSync(snapshot)){
  const now=new Date();const payload={schemaVersion:1,version:1,forumId:c.id,sourceId:'development-ops-fixture',issuedAt:now.toISOString(),validUntil:new Date(now.getTime()+30*86400000).toISOString(),products:[
   {id:'seo-monthly',priceVersion:1,type:'seo_entitlement',name:'Development monthly SEO',durationMonths:1,listPriceCredit:5,salePriceCredit:0,enabled:true,effectiveAt:now.toISOString(),renewalWindowDays:7,discount:{label:'Development activation price',amountCredit:5,percentage:100}},
   {id:'seo-monthly-paid',priceVersion:1,type:'seo_entitlement',name:'Development paid monthly SEO',durationMonths:1,listPriceCredit:5,salePriceCredit:name==='a'?3:4,enabled:true,effectiveAt:now.toISOString(),renewalWindowDays:7},
  ]};const bytes=Buffer.from(JSON.stringify(payload));writeJson(snapshot,{payload:bytes.toString('base64'),checksum:crypto.createHash('sha256').update(bytes).digest('hex'),signature:crypto.sign(null,bytes,fs.readFileSync(secret)).toString('base64')});
 }
 const file=path.join(local(c),'secrets.json'),s=readJson(file);s.opsPriceSnapshotFile=snapshot;s.opsPriceTrustKeyFile=trust;s.opsPriceSourceId='development-ops-fixture';writeJson(file,s);runtime(c);console.log(c.id+': independent signed development price fixture configured; existing file/version preserved');
}
