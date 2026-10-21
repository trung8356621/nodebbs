import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,privateDirectory} from './forum.mjs';
// Reuse the prior native regression without rewriting its historical evidence.
let source=fs.readFileSync(path.join(root,'scripts/test-forum-isolation.mjs'),'utf8');
source=source.replace("from './forum.mjs'","from '../../scripts/forum.mjs'")
 .replace('docs/audit/PHASE2.1B-test-results.json','docs/audit/PHASE2.2-isolation-results.json')
 .replaceAll('docs/audit/screenshots/phase21b','docs/audit/screenshots/phase22-isolation')
 .replace('.local/phase21b-isolation.json','.local/phase22/isolation.json')
 // The new policy tests intentionally use equal titles on A/B. Compare original A content.
 .replace('SELECT title FROM topics ORDER BY id DESC LIMIT 1','SELECT title FROM topics WHERE id<=117 ORDER BY id DESC LIMIT 1');
const file=path.join(privateDirectory(path.join(root,'.local/phase22')),'test-forum-isolation.mjs');
fs.writeFileSync(file,source);
const result=spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit',windowsHide:true});
process.exitCode=result.status ?? 1;
