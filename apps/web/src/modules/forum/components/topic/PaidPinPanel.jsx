"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {usePaidPinExpired} from '@/hooks/usePaidPinExpired';
import {useAuth} from '@/contexts/AuthContext';
import {useTopicContext} from '@/modules/forum/contexts/TopicContext';
import {usePbnTranslations} from '@/i18n/useTranslations';
import api from '@/lib/api';
import Link from '@/components/common/Link';
export default function PaidPinPanel(){
  const {user}=useAuth();const {topic,updateTopic}=useTopicContext();const t=usePbnTranslations();const router=useRouter();
  const [plans,setPlans]=useState([]),[history,setHistory]=useState([]),[balance,setBalance]=useState(0),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const operation=useRef(null);
  const storageKey=`pbn:pin:${user?.id}:${topic.id}`;
  const selectPlan=p=>{
    let pending;try{pending=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
    operation.current=pending?.productId===p.id?pending.key:crypto.randomUUID();
    sessionStorage.setItem(storageKey,JSON.stringify({productId:p.id,key:operation.current}));
    setSelected(p);
  };
  const expired=usePaidPinExpired(topic);
  const owner=user?.id===topic.userId;
  const load=async()=>{const [p,h]=await Promise.all([api.get('/pins/products'),api.get('/pins/topics/'+topic.id)]);setPlans(p);setHistory(h.purchases);setBalance(h.balance);};
  useEffect(()=>{if(owner)load().catch(()=>setMessage(t('pinError')));},[owner,topic.id]);
  const refresh=async()=>{await load();const fresh=await api.get('/topics/'+topic.id);updateTopic(fresh);router.refresh();};
  const purchase=async()=>{if(busy)return;setBusy(true);setMessage('');try{await api.post('/pins/topics/'+topic.id+'/purchase',{productId:selected.id,expectedPrice:selected.price,expectedDuration:selected.durationSeconds,idempotencyKey:operation.current});operation.current=null;sessionStorage.removeItem(storageKey);setSelected(null);await refresh();setMessage(t('pinSuccess'));}catch{setMessage(t('pinError'));}finally{setBusy(false);}};
  const cancel=async()=>{if(!window.confirm(t('pinCancelText')))return;setBusy(true);try{await api.post('/pins/topics/'+topic.id+'/cancel');await refresh();}catch{setMessage(t('pinError'));}finally{setBusy(false);}};
  if(!owner)return null;
  return <section className="content-card p-4 mb-6 space-y-3" data-testid="paid-pin-panel">
    <h2 className="font-semibold">{t('pinTitle')}</h2><p>{t('pinBalance',{balance})}</p>
    <p className="text-sm text-muted-foreground">{t('pinNotice')}</p>
    <p>{topic.pinExpiresAt&&!expired?t('pinEnd',{date:new Date(topic.pinExpiresAt).toLocaleString(t.locale)}):t('pinInactive')}</p>
    <div className="flex flex-wrap gap-3">{plans.map(p=><button className="border rounded px-3 py-2" key={p.id} disabled={busy||balance<p.price} onClick={()=>selectPlan(p)}>{p.name} · {p.price} Credit · {t('pinBuy')}</button>)}</div>
    {selected&&<div role="dialog" aria-label={t('pinConfirm')} className="border rounded p-4 space-y-3"><p>{t('pinConfirmText',{price:selected.price,seconds:selected.durationSeconds})}</p><p>{t('pinNotice')}</p><button className="border rounded px-3 py-2" disabled={busy} onClick={purchase}>{t('pinConfirm')}</button> <button disabled={busy} onClick={()=>setSelected(null)}>{t('pinClose')}</button></div>}
    {topic.pinExpiresAt&&!expired&&<button className="border rounded px-3 py-2" disabled={busy} onClick={cancel}>{t('pinCancel')}</button>}
    <Link className="block underline" href="/profile/wallet">{t('pinWallet')}</Link>
    <p role="status">{message}</p>
    <details><summary>{t('pinHistory')} ({history.length})</summary><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('pinTime')}</th><th>{t('pinAmount')}</th><th>{t('pinEnd',{date:''})}</th><th>{t('pinOperation')}</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString(t.locale)}</td><td>{h.price} ({h.balance_before} → {h.balance_after})</td><td>{new Date(h.ends_at).toLocaleString(t.locale)} · {h.status==='cancelled'?t('pinCancelled'):new Date(h.ends_at)<=new Date()?t('pinExpired'):t('pinActive')}</td><td title={h.idempotency_key}>#{h.transaction_id}</td></tr>)}</tbody></table></div></details>
  </section>;
}
