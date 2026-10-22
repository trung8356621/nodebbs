import {config,runtime} from './forum.mjs';
const [action,file]=process.argv.slice(2);
if(action!=='reconcile'||!file)throw new Error('Usage: node scripts/forum-pins.mjs reconcile forums/forum-a.json');
const c=config(file);Object.assign(process.env,runtime(c));
const {PinService}=await import('../apps/api/src/modules/forum/services/pinService.js');
const {pool}=await import('../apps/api/src/db/index.js');
try{console.log(JSON.stringify({forum:c.id,expired:await new PinService({}).expire(50),batchLimit:50}));}finally{await pool.end();}
