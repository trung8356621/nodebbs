'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useTopicContext} from '@/modules/forum/contexts/TopicContext';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {usePaidPinExpired} from '@/hooks/usePaidPinExpired';
import api from '@/lib/api';
import Link from '@/components/common/Link';
import {Button} from '@/components/ui/button';
export function seoPlanName(product,t){return product.sourceId==='development-ops-fixture'&&['seo-monthly','seo-monthly-paid'].includes(product.productId)?t('seoMonthlyPlan'):product.name;}
const failureCodes=new Set(['RENEWAL_WINDOW','RESERVED','OWNER','REQUOTE','PRICE_UNAVAILABLE','INSUFFICIENT','FROZEN','CONFLICT','QUOTE_INVALID','POLICY','CREDIT_UNAVAILABLE','LOGIN','FORBIDDEN','INVALID','UNAVAILABLE']);
export default function SeoEntitlementPanel(){
  const {user}=useAuth(),{topic,updateTopic}=useTopicContext(),t=usePbnTranslations();
  const [catalog,setCatalog]=useState(null),[history,setHistory]=useState(null),[quote,setQuote]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[selected,setSelected]=useState('');
  const pending=useRef(null),owner=user?.id===topic.userId,expired=usePaidPinExpired(topic),storageKey=`pbn:seo:${user?.id}:${topic.id}`;
  const date=v=>new Date(v).toLocaleString(t.locale,{timeZone:'Asia/Ho_Chi_Minh'});
  const load=async()=>{const [p,h]=await Promise.all([api.get('/seo/products'),api.get('/seo/topics/'+topic.id)]);setCatalog(p);setHistory(h);setSelected(id=>p.products.some(v=>v.productId===id)?id:p.products[0]?.productId||'');};
  const showError=e=>{setSaved(false);setError(failureCodes.has(e.code)?e.code:'UNAVAILABLE');};
  useEffect(()=>{if(owner)load().catch(showError);},[owner,topic.id]);
  const select=async()=>{if(!selected)return;setBusy(true);setError('');setSaved(false);try{
    let stored;try{stored=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
    if(stored?.quote?.product_id===selected){pending.current=stored;setQuote(stored.quote);}else{const q=await api.post('/seo/topics/'+topic.id+'/quotes',{productId:selected});pending.current={quote:q,key:crypto.randomUUID()};sessionStorage.setItem(storageKey,JSON.stringify(pending.current));setQuote(q);}
  }catch(e){showError(e);}finally{setBusy(false);}};
  const confirm=async()=>{if(busy||!pending.current)return;setBusy(true);try{await api.post('/seo/topics/'+topic.id+'/purchase',{quoteId:pending.current.quote.id,idempotencyKey:pending.current.key});sessionStorage.removeItem(storageKey);pending.current=null;setQuote(null);await load();updateTopic(await api.get('/topics/'+topic.id));setError('');setSaved(true);}catch(e){showError(e);if(['REQUOTE','PRICE_UNAVAILABLE','QUOTE_INVALID','CONFLICT'].includes(e.code)){sessionStorage.removeItem(storageKey);pending.current=null;setQuote(null);await load().catch(()=>{});}}finally{setBusy(false);}};
  if(!owner)return null;
  const effective=topic.linkPolicy==='paid'&&!expired,plan=catalog?.products.find(p=>p.productId===selected);
  return <section className="content-card p-4 mb-6 space-y-3" data-testid="seo-panel">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t('seoTitle')}</h2><span className="text-sm">{t('pinBalance',{balance:history?.balance??0})}</span></div>
    <p className="text-sm">{effective?t('seoUntil',{date:date(topic.seoExpiresAt)}):t('seoInactive')}</p>
    {catalog?.products.length>1&&<label className="block text-sm">{t('seoChoosePlan')}<select className="block mt-1 w-full border rounded p-2 bg-background" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy} data-testid="seo-product">{catalog.products.map(p=><option key={p.productId} value={p.productId}>{seoPlanName(p,t)} · {t('seoMonths',{months:p.durationMonths})} · {p.salePriceCredit} Credit</option>)}</select></label>}
    {plan?<div className="flex flex-wrap items-center gap-3"><span>{catalog.products.length===1&&<>{seoPlanName(plan,t)} · {t('seoMonths',{months:plan.durationMonths})} · </>}{plan.listPriceCredit>plan.salePriceCredit&&<><del className="text-muted-foreground">{plan.listPriceCredit} Credit</del> </>}<strong>{plan.salePriceCredit} Credit</strong> <span className="text-sm text-muted-foreground">({(plan.salePriceCredit*catalog.creditVnd).toLocaleString(t.locale)} VND)</span></span><Button disabled={busy} onClick={select}>{effective?t('seoRenew'):plan.salePriceCredit===0?t('seoActivateFree'):t('seoActivate')}</Button></div>:<p>{t('seoUnavailable')}</p>}
    {quote&&<div role="dialog" aria-label={t('seoConfirm')} className="border rounded p-3 space-y-2"><p>{t('seoConfirmTerms',{amount:quote.price_snapshot.salePriceCredit,months:quote.price_snapshot.durationMonths})}</p><Button disabled={busy} onClick={confirm}>{t('seoConfirm')}</Button> <Button variant="ghost" disabled={busy} onClick={()=>setQuote(null)}>{t('pinClose')}</Button></div>}
    {error&&<div role="alert" className="text-sm text-destructive">{t('seoFailure_'+error)}{error==='REQUOTE'&&<Button variant="outline" className="ml-2" disabled={busy} onClick={select}>{t('seoRequote')}</Button>}</div>}
    {saved&&<p role="status" className="text-sm">{t('pinSuccess')}</p>}
    <Link href="/profile/wallet#seo-activity" className="text-sm underline">{t('seoWalletHistory')}</Link>
  </section>;
}
