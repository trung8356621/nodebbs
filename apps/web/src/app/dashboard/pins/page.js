"use client";
import {useEffect,useState} from 'react';
import api from '@/lib/api';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {usePermission} from '@/hooks/usePermission';
export default function PinsAdmin(){
  const t=usePbnTranslations();const {hasPermission}=usePermission();
  const [data,setData]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null);
  const load=async()=>setData(await api.get('/pins/admin'));
  useEffect(()=>{load().catch(()=>setMessage(t('pinError')));},[]);
  const run=async action=>{setBusy(true);setMessage('');try{await action();await load();setMessage(t('pinSuccess'));}catch{setMessage(t('pinError'));}finally{setBusy(false);}};
  const save=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const body={name:f.get('name'),price:Number(f.get('price')),durationSeconds:Number(f.get('durationSeconds')),enabled:f.get('enabled')==='on',displayOrder:Number(f.get('displayOrder'))};run(async()=>{if(editing)await api.put('/pins/admin/products/'+editing.id,body);else await api.post('/pins/admin/products',body);setEditing(null);});};
  const classify=e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>api.put('/pins/admin/topics/'+Number(f.get('topicId'))+'/classification',{editorial:f.get('editorial')==='on',advertising:f.get('advertising')==='on',reason:f.get('reason')}));};
  const correct=e=>{const reason=window.prompt(t('pinReason'));if(!reason||!window.confirm(t('pinCorrectConfirm')))return;run(()=>api.post('/pins/admin/entitlements/'+e.id+'/correct',{reason,idempotencyKey:crypto.randomUUID()}));};
  return <div className="p-4 space-y-6 max-w-6xl"><h1 className="text-2xl font-semibold">{t('pinAdmin')}</h1><p role="status">{message}</p>
    <section className="border rounded p-4 space-y-3"><h2>{t('pinPlans')}</h2><form key={editing?.id||'new'} onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label>{t('pinName')}<input className="block border rounded p-2" name="name" required maxLength={100} defaultValue={editing?.name}/></label>
      <label>{t('pinPrice')}<input className="block border rounded p-2 w-28" type="number" name="price" min="1" max="1000000000" required defaultValue={editing?.price||10}/></label>
      <label>{t('pinSeconds')}<input className="block border rounded p-2 w-36" type="number" name="durationSeconds" min="60" max="31536000" required defaultValue={editing?JSON.parse(editing.metadata).durationSeconds:86400}/></label>
      <label>{t('pinOrder')}<input className="block border rounded p-2 w-24" type="number" name="displayOrder" defaultValue={editing?.displayOrder||0}/></label>
      <label><input type="checkbox" name="enabled" defaultChecked={editing?editing.isActive:true}/> {t('pinEnabled')}</label><button className="border rounded p-2" disabled={busy}>{t('pinSave')}</button></form>
      {data?.products.map(p=><div className="flex gap-4" key={p.id}><span>{p.id} · {p.name} · {p.price} Credit · {p.isActive?'✓':'—'}</span><button disabled={busy} onClick={()=>setEditing(p)}>{t('pinEditPlan')}</button></div>)}
    </section>
    {hasPermission('editorial.classify')&&<form className="border rounded p-4 flex flex-wrap gap-3" onSubmit={classify}><label>{t('pinTopic')}<input className="block border rounded p-2 w-24" required type="number" name="topicId" min="1"/></label><label><input name="editorial" type="checkbox"/> {t('pinEditorial')}</label><label><input name="advertising" type="checkbox"/> {t('pinAdvertising')}</label><label>{t('pinReason')}<input className="block border rounded p-2" name="reason" minLength={10} maxLength={500} required/></label><button disabled={busy}>{t('pinReview')}</button></form>}
    <section className="space-y-3"><h2>{t('pinHistory')}</h2><button className="border rounded p-2" disabled={busy} onClick={()=>run(()=>api.post('/pins/admin/reconcile'))}>{t('pinReconcile')}</button><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('pinTopic')}</th><th>{t('pinAmount')}</th><th>{t('pinEnd',{date:''})}</th><th>{t('pinOperation')}</th></tr></thead><tbody>{data?.entitlements.map(e=><tr key={e.id}><td>{e.topic_id} / {e.user_id}</td><td>{e.price} ({e.balance_before} → {e.balance_after})</td><td>{new Date(e.ends_at).toLocaleString(t.locale)} · {e.status==='cancelled'?t('pinCancelled'):new Date(e.ends_at)<=new Date()?t('pinExpired'):t('pinActive')}</td><td>{e.transaction_id} · {e.idempotency_key} {hasPermission('dashboard.ledger')&&<button className="block underline" disabled={busy} onClick={()=>correct(e)}>{t('pinCorrect')}</button>}</td></tr>)}</tbody></table></div></section>
    <section><h2>{t('pinEvents')}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{data?.events.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString(t.locale)}</td><td>{e.topic_id}</td><td>{e.type}</td><td>{e.actor_id||'worker'}</td><td>{e.reason}</td></tr>)}</tbody></table></div></section>
  </div>;
}
