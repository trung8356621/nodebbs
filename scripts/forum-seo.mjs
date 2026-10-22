import {config,runtime} from './forum.mjs';
const [action,file]=process.argv.slice(2);if(!['sync','reconcile'].includes(action)||!file)throw new Error('Usage: node scripts/forum-seo.mjs sync|reconcile forums/forum-a.json');
const c=config(file);Object.assign(process.env,runtime(c));const {pool}=await import('../apps/api/src/db/index.js');
try{if(action==='sync'){const {synchronizeConfiguredPrices}=await import('../apps/api/src/modules/forum/services/seo/prices.js');console.log(JSON.stringify({forum:c.id,...await synchronizeConfiguredPrices(pool)}));}else{const {SeoService}=await import('../apps/api/src/modules/forum/services/seo/service.js');console.log(JSON.stringify({forum:c.id,expired:await new SeoService({}).expire(),limit:50}));}}finally{await pool.end();}
