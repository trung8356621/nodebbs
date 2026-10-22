export function seoError(error) {
  const message=String(error.message||'');
  const rules=[[/renewal window/,'RENEWAL_WINDOW'],[/reserved topic/,'RESERVED'],[/owner/,'OWNER'],[/price changed|quote expired/,'REQUOTE'],[/No authorized/,'PRICE_UNAVAILABLE'],[/Insufficient funds/,'INSUFFICIENT'],[/frozen/,'FROZEN'],[/Idempotency|already used/,'CONFLICT'],[/quote is invalid/,'QUOTE_INVALID'],[/not eligible/,'POLICY'],[/Credit is unavailable/,'CREDIT_UNAVAILABLE']];
  const known=rules.find(([pattern])=>pattern.test(message));
  const status=error.statusCode>=400&&error.statusCode<500?error.statusCode:500;
  return {status,code:known?.[1]||(status===401?'LOGIN':status===403?'FORBIDDEN':status===400?'INVALID':'UNAVAILABLE'),message:status===500?'SEO checkout is temporarily unavailable; please try again':message};
}
