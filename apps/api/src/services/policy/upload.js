import { responseLocale } from '../../i18n/translate.js';
const raster = new Set(['jpg','jpeg','png','gif','webp','ico','avif']);
const active = new Set(['html','htm','xhtml','shtml','mhtml','svg','svgz','xml','js','mjs','cjs']);
export async function rejectActiveUpload(fastify,request,reply,filename,mimetype,category) {
  const ext=String(filename).toLowerCase().split('.').at(-1);
  if(!active.has(ext) && !/html|svg|xml|javascript|ecmascript/i.test(mimetype || '') && (category==='attachments' || raster.has(ext))) return false;
  const decision=await fastify.policy.inspect('', 'upload',null,request.user.id,undefined,{action:'BLOCK',ruleIds:[],reason:'ACTIVE_UPLOAD_UNSUPPORTED'});
  reply.code(422).send({code:'POLICY_BLOCKED',decisionId:decision.id,error:responseLocale(request.headers)==='vi-VN'?'Không thể đăng nội dung do vi phạm quy định cộng đồng.':'This content cannot be published because it violates community rules.'});
  return true;
}
