import assert from 'node:assert/strict';
import fs from 'node:fs';
import {contentLinkRel} from '../apps/web/src/lib/content-link-policy.js';
const origin='http://127.0.0.1:3100';const checks=[];
for(const policy of ['ugc','paid','sponsored','editorial']){
 for(const href of ['https://example.org/a','HTTPS://EXAMPLE.ORG/b','//example.net/path','https://127.0.0.1:3100/a','http://127.0.0.1:3200/a']){
  const tokens=contentLinkRel(href,{policy,canonicalOrigin:origin}).split(' ');assert(tokens.includes('noopener')&&tokens.includes('noreferrer'));assert.equal(tokens.includes('ugc'),policy!=='editorial');assert.equal(tokens.includes('sponsored'),['paid','sponsored'].includes(policy));assert.equal(tokens.includes('nofollow'),policy==='ugc');assert(!tokens.includes('dofollow'));
 }
 for(const href of ['/topic/1','#reply','../topic/2',origin+'/topic/1'])assert.equal(contentLinkRel(href,{policy,canonicalOrigin:origin}),'noopener noreferrer');
}
assert.equal(contentLinkRel('mailto:reader@example.org'),'noopener noreferrer');
checks.push('Exact external HTTP(S) tokens for normal, paid, sponsored and independently reviewed editorial; mixed-case and protocol-relative URLs');
checks.push('Relative, fragment and exact-origin internal links remain separate; different scheme or port is external; no invented dofollow token');
fs.writeFileSync('docs/audit/PHASE2.3-SEO-link-unit-results.json',JSON.stringify({status:'PASS',checks},null,2)+'\n');console.log('PASS rendered content link classification URL/token matrix');
