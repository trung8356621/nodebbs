'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useTopicContext} from '@/modules/forum/contexts/TopicContext';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {useDeadlineExpired} from '@/hooks/usePaidPinExpired';
import api from '@/lib/api';
import Link from '@/components/common/Link';
import {Button} from '@/components/ui/button';

const failureCodes=new Set(['OWNER','PRICE_UNAVAILABLE','INSUFFICIENT','FROZEN','CONFLICT','POLICY','CREDIT_UNAVAILABLE','LOGIN','FORBIDDEN','INVALID','UNAVAILABLE']);

function formatDuration(seconds,t){
  if(!Number.isFinite(seconds)||seconds<=0)return '—';
  if(seconds%86400===0)return t('pinDurationDays',{days:seconds/86400});
  if(seconds%3600===0)return t('pinDurationHours',{hours:seconds/3600});
  return t('pinSecondsLabel',{seconds});
}

export default function PaidPinPanel(){
  const {user}=useAuth(),{topic,updateTopic}=useTopicContext(),t=usePbnTranslations();
  const [catalog,setCatalog]=useState(null),[history,setHistory]=useState(null),[confirmPlan,setConfirmPlan]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[selected,setSelected]=useState('');
  const pendingKey=useRef(null),owner=user?.id===topic.userId,expired=useDeadlineExpired(topic.pinExpiresAt,topic.pinServerNow),storageKey=`pbn:pin:${user?.id}:${topic.id}`;
  const date=v=>new Date(v).toLocaleString(t.locale,{timeZone:'Asia/Ho_Chi_Minh'});
  const activeEnd=!expired&&topic.pinExpiresAt?topic.pinExpiresAt:null;
  const load=async()=>{
    const [products,topicPins]=await Promise.all([api.get('/pins/products'),api.get('/pins/topics/'+topic.id)]);
    setCatalog(products);setHistory(topicPins);
    const plans=products.plans||[];
    setSelected(id=>plans.some(p=>p.code===id||String(p.id)===id)?id:(plans[0]?.code||plans[0]?.id||''));
  };
  const showError=e=>{setSaved(false);setError(failureCodes.has(e.code)?e.code:'UNAVAILABLE');};
  useEffect(()=>{if(owner)load().catch(showError);},[owner,topic.id]);
  const plan=(catalog?.plans||[]).find(p=>p.code===selected||String(p.id)===selected);
  const beginPurchase=()=>{
    if(!plan||busy)return;
    setError('');setSaved(false);
    let key;
    try{const stored=JSON.parse(sessionStorage.getItem(storageKey));if(stored?.skuCode===plan.code&&stored?.key)key=stored.key;}catch{}
    if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,JSON.stringify({skuCode:plan.code,key,expectedPrice:plan.price,expectedDuration:plan.durationSeconds}));}
    pendingKey.current=key;setConfirmPlan(plan);
  };
  const confirm=async()=>{
    if(busy||!confirmPlan||!pendingKey.current)return;
    setBusy(true);
    try{
      await api.post('/pins/topics/'+topic.id+'/purchase',{
        skuCode:confirmPlan.code,
        expectedPrice:confirmPlan.price,
        expectedDuration:confirmPlan.durationSeconds,
        idempotencyKey:pendingKey.current,
      });
      sessionStorage.removeItem(storageKey);pendingKey.current=null;setConfirmPlan(null);
      await load();updateTopic(await api.get('/topics/'+topic.id));setError('');setSaved(true);
    }catch(e){
      showError(e);
      if(['PRICE_UNAVAILABLE','CONFLICT','INVALID'].includes(e.code)){
        sessionStorage.removeItem(storageKey);pendingKey.current=null;setConfirmPlan(null);await load().catch(()=>{});
      }
    }finally{setBusy(false);}
  };
  const cancel=async()=>{
    if(busy||!window.confirm(t('pinCancelText')))return;
    setBusy(true);setError('');
    try{await api.post('/pins/topics/'+topic.id+'/cancel');await load();updateTopic(await api.get('/topics/'+topic.id));setSaved(true);}
    catch(e){showError(e);}finally{setBusy(false);}
  };
  if(!owner)return null;
  const plans=catalog?.plans||[];
  const catalogOk=Array.isArray(plans)&&plans.length>0;
  return <section className="content-card p-4 mb-6 space-y-3" data-testid="paid-pin-panel">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">{t('pinTitle')}</h2>
      <span className="text-sm">{t('pinBalance',{balance:history?.balance??0})}</span>
    </div>
    <p className="text-sm text-muted-foreground">{t('pinNotice')}</p>
    <p className="text-sm">{activeEnd?t('pinEnd',{date:date(activeEnd)}):t('pinInactive')}</p>
    {!catalogOk&&<p role="status" className="text-sm text-destructive">{t('pinCatalogUnavailable')}</p>}
    {plans.length>1&&<label className="block text-sm">{t('pinPlans')}
      <select className="block mt-1 w-full border rounded p-2 bg-background" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy} data-testid="pin-product">
        {plans.map(p=><option key={p.code||p.id} value={p.code||p.id}>{p.name} · {formatDuration(p.durationSeconds,t)} · {p.price} Credit</option>)}
      </select>
    </label>}
    {plan?<div className="flex flex-wrap items-center gap-3">
      <span>{plans.length===1&&<>{plan.name} · {formatDuration(plan.durationSeconds,t)} · </>}<strong>{plan.price} Credit</strong></span>
      <Button disabled={busy||!catalogOk} onClick={beginPurchase}>{activeEnd?t('pinBuy'):t('pinBuy')}</Button>
      {activeEnd&&<Button variant="outline" disabled={busy} onClick={cancel}>{t('pinCancel')}</Button>}
    </div>:<p className="text-sm">{t('pinCatalogUnavailable')}</p>}
    {confirmPlan&&<div role="dialog" aria-label={t('pinConfirm')} className="border rounded p-3 space-y-2">
      <p>{t('pinConfirmText',{price:confirmPlan.price,seconds:confirmPlan.durationSeconds})}</p>
      <Button disabled={busy} onClick={confirm}>{t('pinConfirm')}</Button>
      <Button variant="ghost" disabled={busy} onClick={()=>setConfirmPlan(null)}>{t('pinClose')}</Button>
    </div>}
    {error&&<div role="alert" className="text-sm text-destructive">{t('pinFailure_'+error)}</div>}
    {saved&&<p role="status" className="text-sm">{t('pinSuccess')}</p>}
    <Link href="/profile/wallet" className="text-sm underline">{t('pinWallet')}</Link>
  </section>;
}
