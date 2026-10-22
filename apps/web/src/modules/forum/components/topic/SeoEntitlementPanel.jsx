'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useTopicContext} from '@/modules/forum/contexts/TopicContext';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {usePaidPinExpired} from '@/hooks/usePaidPinExpired';
import api from '@/lib/api';
import Link from '@/components/common/Link';
export default function SeoEntitlementPanel(){
  const {user}=useAuth(),{topic,updateTopic}=useTopicContext(),t=usePbnTranslations();
  const [catalog,setCatalog]=useState(null),[history,setHistory]=useState(null),[quote,setQuote]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const pending=useRef(null);const owner=user?.id===topic.userId;const expired=usePaidPinExpired(topic);
  const storageKey=`pbn:seo:${user?.id}:${topic.id}`;
  const date=v=>new Date(v).toLocaleString(t.locale,{timeZone:'Asia/Ho_Chi_Minh'});
  const money=(amount,rate)=>t('seoPrice',{amount,vnd:(amount*rate).toLocaleString(t.locale)});
  const load=async()=>{const [p,h]=await Promise.all([api.get('/seo/products'),api.get('/seo/topics/'+topic.id)]);setCatalog(p);setHistory(h);};
  useEffect(()=>{if(owner)load().catch(()=>setMessage(t('seoError')));},[owner,topic.id]);
  const refresh=async()=>{await load();updateTopic(await api.get('/topics/'+topic.id));};
  const select=async p=>{setBusy(true);setMessage('');try{
    let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
    if(saved?.quote?.product_id===p.productId){pending.current=saved;setQuote(saved.quote);}else{const q=await api.post('/seo/topics/'+topic.id+'/quotes',{productId:p.productId});pending.current={quote:q,key:crypto.randomUUID()};sessionStorage.setItem(storageKey,JSON.stringify(pending.current));setQuote(q);}
  }catch{setMessage(t('seoError'));}finally{setBusy(false);}};
  const confirm=async()=>{if(busy||!pending.current)return;setBusy(true);try{await api.post('/seo/topics/'+topic.id+'/purchase',{quoteId:pending.current.quote.id,idempotencyKey:pending.current.key});sessionStorage.removeItem(storageKey);pending.current=null;setQuote(null);await refresh();setMessage(t('pinSuccess'));}catch(error){setMessage(t('seoError'));if(error.status===409){sessionStorage.removeItem(storageKey);pending.current=null;setQuote(null);await load();}}finally{setBusy(false);}};
  const cancel=async()=>{if(!window.confirm(t('seoNoRefund')))return;setBusy(true);try{await api.post('/seo/topics/'+topic.id+'/cancel');await refresh();setMessage(t('pinSuccess'));}catch{setMessage(t('seoError'));}finally{setBusy(false);}};
  if(!owner)return null;
  const effective=topic.linkPolicy==='paid'&&!expired;
  return <section className="content-card p-4 mb-6 space-y-3" data-testid="seo-panel">
    <h2 className="font-semibold">{t('seoTitle')}</h2><p className="text-sm text-muted-foreground">{t('seoNoPlacement')}</p>
    <p>{t('pinBalance',{balance:history?.balance??0})}</p><p>{effective?t('seoUntil',{date:date(topic.seoExpiresAt)}):t('seoInactive')}</p>
    {!history?.allowed&&history?<p>{t('seoReserved')}</p>:<div className="space-y-3">{catalog?.products.map(p=><div key={p.productId} className="border rounded p-3 space-y-2">
      <h3 className="font-medium">{p.name} · {t('seoMonths',{months:p.durationMonths})}</h3>
      {p.listPriceCredit>p.salePriceCredit&&<p>{t('seoList')}: <del>{money(p.listPriceCredit,catalog.creditVnd)}</del> · {t('seoDiscount',{amount:p.listPriceCredit-p.salePriceCredit})}</p>}
      <p>{t('seoSale')}: {money(p.salePriceCredit,catalog.creditVnd)} · {t('seoVersion')}: {p.snapshotVersion}/{p.priceVersion}</p>
      <button className="border rounded px-3 py-2" disabled={busy||(history?.balance??0)<p.salePriceCredit} onClick={()=>select(p)}>{p.salePriceCredit===0?t('seoActivateFree'):t('seoBuy')}</button>
    </div>)}{catalog&&!catalog.products.length&&<p>{t('seoUnavailable')}</p>}</div>}
    <p className="text-sm text-muted-foreground">{t('seoRenewWindow')}</p>
    {quote&&<div role="dialog" aria-label={t('seoConfirm')} className="border rounded p-4 space-y-3"><p>{t('seoConfirmTerms',{amount:quote.price_snapshot.salePriceCredit,months:quote.price_snapshot.durationMonths})}</p><p>{money(quote.price_snapshot.salePriceCredit,quote.creditVnd)}</p><p>{t('seoQuoteUntil',{date:date(quote.expires_at)})}</p><button className="border rounded px-3 py-2" disabled={busy} onClick={confirm}>{t('seoConfirm')}</button> <button disabled={busy} onClick={()=>setQuote(null)}>{t('pinClose')}</button></div>}
    {effective&&<button className="border rounded px-3 py-2" disabled={busy} onClick={cancel}>{t('seoCancel')}</button>}
    <p role="status">{message}</p><Link href="/profile/wallet" className="block underline">{t('pinWallet')}</Link>
    <details><summary>{t('seoHistory')} ({history?.purchases.length||0})</summary><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('pinTime')}</th><th>{t('seoOriginalCharge')}</th><th>{t('seoVersion')}</th><th>{t('seoUntil',{date:''})}</th><th>{t('pinOperation')}</th></tr></thead><tbody>{history?.purchases.map(p=><tr key={p.id}><td>{date(p.created_at)}</td><td>{p.paid_price} Credit</td><td>{p.snapshot_version}/{p.price_version}</td><td>{date(p.expires_at)} · {p.status==='cancelled'?t('pinCancelled'):new Date(p.expires_at)<=new Date()?t('pinExpired'):t('pinActive')}</td><td title={p.idempotency_key}>{p.transaction_id?'#'+p.transaction_id:t('seoActivateFree')}</td></tr>)}</tbody></table></div></details>
  </section>;
}
