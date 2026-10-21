import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,config,local,readJson,writeJson,privateDirectory} from './forum.mjs';
const dir=privateDirectory(path.join(root,'.local/phase22'));
const keyFile=path.join(dir,'policy-private.pem'), publicFile=path.join(dir,'policy-public.pem'), snapshotFile=path.join(dir,'global-policy.json');
if(!fs.existsSync(keyFile)) {
  const keys=crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(keyFile,keys.privateKey.export({type:'pkcs8',format:'pem'}));
  fs.writeFileSync(publicFile,keys.publicKey.export({type:'spki',format:'pem'}));
}
const document=readJson(path.join(root,'scripts/fixtures/policy-development.json'));
const payload=Buffer.from(JSON.stringify(document));
if(!fs.existsSync(snapshotFile)) writeJson(snapshotFile,{payload:payload.toString('base64'),checksum:crypto.createHash('sha256').update(payload).digest('hex'),signature:crypto.sign(null,payload,fs.readFileSync(keyFile)).toString('base64')});
for(const name of ['a','b']) {const c=config('forums/forum-'+name+'.json'), file=path.join(local(c),'secrets.json'),s=readJson(file);s.policyTrustKeyFile=publicFile;s.policySnapshotFile=snapshotFile;writeJson(file,s);}
console.log('Configured signed development fixture for A/B; signing private key remains ignored and owner-protected');
