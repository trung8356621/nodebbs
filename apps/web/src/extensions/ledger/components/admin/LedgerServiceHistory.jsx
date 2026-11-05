'use client';

import {useEffect,useState} from 'react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {usePermission} from '@/hooks/usePermission';
import {Button} from '@/components/ui/button';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import api from '@/lib/api';

export function LedgerServiceHistory(){
  const t=usePbnTranslations();
  const {hasPermission}=usePermission();
  const [seo,setSeo]=useState(null);
  const [pins,setPins]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);

  const date=v=>v?new Date(v).toLocaleString(t.locale,{timeZone:seo?.businessTimeZone||'Asia/Ho_Chi_Minh'}):'—';
  const canManage=hasPermission('dashboard.extensions');
  const canCorrect=hasPermission('dashboard.ledger')||hasPermission('dashboard.extensions');
  const canEditorial=hasPermission('editorial.classify');

  const load=async()=>{
    setLoading(true);
    setLoadError('');
    if(!canManage){
      setLoadError(t('ledgerHistoryForbidden'));
      setLoading(false);
      return;
    }
    try{
      // History is local DB — do not block on OPS/catalog availability.
      const seoAdmin=await api.get('/seo/admin');
      setSeo(seoAdmin);
      try{
        setPins(await api.get('/pins/admin'));
      }catch{
        setPins({entitlements:[],events:[],catalogPlans:null});
      }
    }catch(err){
      setSeo(null);
      setLoadError(err?.code==='FORBIDDEN'||err?.status===403?t('ledgerHistoryForbidden'):(err?.message||t('seoError')));
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{load();},[canManage]);

  const run=async fn=>{
    setBusy(true);setMessage('');
    try{await fn();await load();setMessage(t('pinSuccess'));}
    catch(err){setMessage(err?.message||t('seoError'));}
    finally{setBusy(false);}
  };

  const reserve=e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    run(()=>api.put('/seo/admin/topics/'+Number(f.get('topicId'))+'/eligibility',{
      allowed:f.get('allowed')==='on',
      reason:f.get('reason'),
    }));
  };

  const correctSeo=p=>{
    const reason=window.prompt(t('pinReason'));
    if(!reason||!window.confirm(t('pinCorrectConfirm')))return;
    run(()=>api.post('/seo/admin/purchases/'+p.id+'/correct',{reason,idempotencyKey:crypto.randomUUID()}));
  };

  const correctPin=e=>{
    const reason=window.prompt(t('pinReason'));
    if(!reason||!window.confirm(t('pinCorrectConfirm')))return;
    run(()=>api.post('/pins/admin/entitlements/'+e.id+'/correct',{reason,idempotencyKey:crypto.randomUUID()}));
  };

  const labels={
    purchase:t('seoEventPurchase'),
    cancel:t('seoEventCancel'),
    expire:t('seoEventExpire'),
    correction:t('seoEventCorrection'),
    restriction:t('seoEventRestriction'),
  };

  if(loading)return <p className="text-sm text-muted-foreground">{t('ledgerServicesLoading')}</p>;
  if(loadError&&!seo)return <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{loadError}</p><Button variant="outline" onClick={load}>{t('ledgerHistoryRetry')}</Button></div>;

  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('ledgerHistoryIntro')}</p>
    {message&&<p role="status" className="text-sm">{message}</p>}
    {loadError&&seo&&<p role="status" className="text-sm text-amber-700">{loadError}</p>}
    <Tabs defaultValue="seo-purchases">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="seo-purchases">{t('seoHistory')}</TabsTrigger>
        <TabsTrigger value="seo-events">{t('pinEvents')} SEO</TabsTrigger>
        <TabsTrigger value="seo-schedule">{t('seoSchedule')}</TabsTrigger>
        <TabsTrigger value="pin-entitlements">{t('pinHistory')}</TabsTrigger>
        {canEditorial&&<TabsTrigger value="seo-restriction">{t('seoRestriction')}</TabsTrigger>}
      </TabsList>

      <TabsContent value="seo-purchases" className="space-y-3">
        <Button disabled={busy} onClick={()=>run(()=>api.post('/seo/admin/reconcile'))}>{t('pinReconcile')} SEO</Button>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th>{t('pinTopic')}</th><th>{t('seoVersion')}</th><th>{t('seoOriginalCharge')}</th><th>{t('seoUntil',{date:''})}</th><th>{t('pinOperation')}</th></tr></thead>
            <tbody>{(seo?.purchases||[]).map(p=><tr key={p.id}>
              <td>{p.topic_id} / {p.user_id}</td>
              <td>{p.snapshot_version}/{p.price_version}</td>
              <td>{p.paid_price} Credit ({p.balance_before} → {p.balance_after})</td>
              <td>{date(p.expires_at)} · {p.status==='cancelled'?t('pinCancelled'):new Date(p.expires_at)<=new Date()?t('pinExpired'):t('pinActive')}</td>
              <td title={p.idempotency_key}>{p.transaction_id?'#'+p.transaction_id:t('seoActivateFree')}{canCorrect&&<button type="button" className="block underline" disabled={busy} onClick={()=>correctSeo(p)}>{t('pinCorrect')}</button>}</td>
            </tr>)}</tbody>
          </table>
          {!seo?.purchases?.length&&<p className="text-sm text-muted-foreground py-4">{t('ledgerHistoryEmpty')}</p>}
        </div>
      </TabsContent>

      <TabsContent value="seo-events">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>{(seo?.events||[]).map(e=><tr key={e.id}>
              <td>{date(e.created_at)}</td><td>{e.topic_id}</td><td>{labels[e.type]||e.type}</td><td>{e.actor_id||t('seoWorker')}</td><td>{e.reason}</td>
            </tr>)}</tbody>
          </table>
          {!seo?.events?.length&&<p className="text-sm text-muted-foreground py-4">{t('ledgerHistoryEmpty')}</p>}
        </div>
      </TabsContent>

      <TabsContent value="seo-schedule" className="space-y-3">
        <section className="border rounded p-4 space-y-2">
          <h3 className="font-medium">{t('seoSync')}</h3>
          <p>{seo?.sourceConfigured?t('seoConfigured'):t('seoMissing')}</p>
          <p className="text-sm text-muted-foreground">{t('seoReadOnly')}</p>
          <p className="text-sm">{t('ledgerPricingLegacy',{authority:seo?.authority||'legacy-seo-envelope'})}</p>
          {(seo?.snapshots||[]).slice(0,1).map(s=><div key={s.version}>
            <p>{t('seoVersion')}: {s.version} · {t('seoValidUntil',{date:date(s.valid_until)})}</p>
            <p className="break-all text-xs">{t('seoSource')}: {s.source_id} / {s.checksum}</p>
          </div>)}
        </section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th>{t('pinName')}</th><th>{t('seoVersion')}</th><th>{t('seoList')}</th><th>{t('seoSale')}</th><th>{t('seoEffective')}</th></tr></thead>
            <tbody>{(seo?.schedule||[]).map(p=><tr key={p.product_id+':'+p.price_version}>
              <td>{p.name} · {t('seoMonths',{months:p.duration_months})} · {p.enabled?'✓':'—'}</td>
              <td>{p.snapshot_version}/{p.price_version}</td>
              <td>{p.list_price} Credit</td>
              <td>{p.sale_price} Credit · {(Number(p.sale_price)*(seo.creditVnd||0)).toLocaleString(t.locale)} VND</td>
              <td>{date(p.effective_at)} → {date(p.ends_at)}</td>
            </tr>)}</tbody>
          </table>
          {!seo?.schedule?.length&&<p className="text-sm text-muted-foreground py-4">{t('ledgerHistoryEmpty')}</p>}
        </div>
      </TabsContent>

      <TabsContent value="pin-entitlements" className="space-y-3">
        <Button disabled={busy} onClick={()=>run(()=>api.post('/pins/admin/reconcile'))}>{t('pinReconcile')} Pin</Button>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th>{t('pinTopic')}</th><th>SKU</th><th>{t('pinPrice')}</th><th>{t('pinEnd',{date:''})}</th><th>{t('pinOperation')}</th></tr></thead>
            <tbody>{(pins?.entitlements||[]).map(e=><tr key={e.id}>
              <td>{e.topic_id} / {e.user_id}</td>
              <td className="font-mono text-xs">{e.ops_sku_code||e.product_id||'—'}</td>
              <td>{e.price} Credit</td>
              <td>{date(e.ends_at)} · {e.status==='cancelled'?t('pinCancelled'):e.status==='expired'||new Date(e.ends_at)<=new Date()?t('pinExpired'):t('pinActive')}</td>
              <td>{e.transaction_id?'#'+e.transaction_id:'—'}{canCorrect&&e.status==='active'&&<button type="button" className="block underline" disabled={busy} onClick={()=>correctPin(e)}>{t('pinCorrect')}</button>}</td>
            </tr>)}</tbody>
          </table>
          {!pins?.entitlements?.length&&<p className="text-sm text-muted-foreground py-4">{t('ledgerHistoryEmpty')}</p>}
        </div>
      </TabsContent>

      {canEditorial&&<TabsContent value="seo-restriction">
        <form onSubmit={reserve} className="border rounded p-4 flex flex-wrap gap-3 items-end">
          <h3 className="w-full font-medium">{t('seoRestriction')}</h3>
          <label>{t('pinTopic')}<input className="block border rounded p-2 w-24" type="number" name="topicId" min="1" required/></label>
          <label><input type="checkbox" name="allowed" defaultChecked/> {t('seoAllowed')}</label>
          <label>{t('pinReason')}<input className="block border rounded p-2" name="reason" minLength={10} maxLength={500} required/></label>
          <Button type="submit" disabled={busy}>{t('seoSaveRestriction')}</Button>
        </form>
      </TabsContent>}
    </Tabs>
  </div>;
}
