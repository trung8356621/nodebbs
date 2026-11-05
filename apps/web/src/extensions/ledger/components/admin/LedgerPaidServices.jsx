'use client';

import {useCallback,useEffect,useState} from 'react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import Link from '@/components/common/Link';
import {toast} from 'sonner';
import {LedgerRewardRules} from './LedgerRewardRules';

function StatusBadge({tone='default',children}){
  const variant=tone==='ok'?'default':tone==='warn'?'secondary':'outline';
  return <Badge variant={variant}>{children}</Badge>;
}

function formatCredit(value,locale){
  if(value==null||value==='')return '—';
  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  return `${n.toLocaleString(locale)} Credit`;
}

function formatVnd(value,locale){
  if(value==null||value==='')return '—';
  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  return `${n.toLocaleString(locale)} ₫`;
}

function sourceLabel(t,source){
  if(source==='forum_base')return t('ledgerPriceSourceForum');
  if(source==='ops_override')return t('ledgerPriceSourceOpsOverride');
  if(source==='free_mode')return t('ledgerPriceSourceFreeMode');
  if(source==='ops_ban')return t('ledgerPriceSourceOpsBan');
  return source||'—';
}

function serviceTitle(t,code){
  if(code==='paid_pin')return t('ledgerServicePinTitle');
  if(code==='seo_entitlement')return t('ledgerServiceSeoTitle');
  return code;
}

function serviceDesc(t,code){
  if(code==='paid_pin')return t('ledgerServicePinDescShort');
  if(code==='seo_entitlement')return t('ledgerServiceSeoDescShort');
  return '';
}

/**
 * Compact commercial catalog (pin + SEO). Credit packages and OPS diagnostics live elsewhere.
 */
export function LedgerPaidServices(){
  const t=usePbnTranslations();
  const [loading,setLoading]=useState(true);
  const [payload,setPayload]=useState(null);
  const [loadError,setLoadError]=useState('');
  const [detail,setDetail]=useState(null);
  const [history,setHistory]=useState(null);
  const [saving,setSaving]=useState(false);
  const [draft,setDraft]=useState({});

  const load=useCallback(async()=>{
    setLoading(true);setLoadError('');
    try{
      const res=await api.get('/forum/local-pricing/services');
      const data=res?.data||res;
      setPayload(data);
    }catch(err){
      setLoadError(err?.message||'Failed to load services');
      setPayload(null);
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{load();},[load]);

  const openEdit=(svc)=>{
    setDetail(svc.serviceCode);
    setDraft({
      basePriceVnd:String(svc.basePriceVnd??''),
      enabled:Boolean(svc.enabled),
      durationSeconds:String(svc.options?.durationSeconds??86400),
      durationMonths:String(svc.options?.durationMonths??1),
    });
  };

  const saveService=async()=>{
    if(!detail)return;
    const basePriceVnd=Number(draft.basePriceVnd);
    if(!Number.isSafeInteger(basePriceVnd)||basePriceVnd<0){
      toast.error(t('ledgerLocalPriceInvalid'));
      return;
    }
    const body={basePriceVnd,enabled:Boolean(draft.enabled),options:{}};
    if(detail==='paid_pin'){
      const durationSeconds=Number(draft.durationSeconds);
      if(!Number.isInteger(durationSeconds)||durationSeconds<60){
        toast.error(t('ledgerLocalDurationInvalid'));
        return;
      }
      body.options.durationSeconds=durationSeconds;
    }
    if(detail==='seo_entitlement'){
      const durationMonths=Number(draft.durationMonths);
      if(!Number.isInteger(durationMonths)||durationMonths<1){
        toast.error(t('ledgerLocalDurationInvalid'));
        return;
      }
      body.options.durationMonths=durationMonths;
    }
    setSaving(true);
    try{
      await api.patch(`/forum/local-pricing/services/${detail}`,body);
      toast.success(t('ledgerLocalPriceSaved'));
      setDetail(null);
      await load();
    }catch(err){
      toast.error(err?.message||t('seoError'));
    }finally{
      setSaving(false);
    }
  };

  const toggleFreeMode=async(enabled)=>{
    setSaving(true);
    try{
      await api.patch('/forum/local-pricing/settings/free-mode',{enabled});
      toast.success(enabled?t('ledgerFreeModeOn'):t('ledgerFreeModeOff'));
      await load();
    }catch(err){
      toast.error(err?.message||t('seoError'));
    }finally{
      setSaving(false);
    }
  };

  const openHistory=async(serviceCode)=>{
    try{
      const res=await api.get(`/forum/local-pricing/services/${serviceCode}/history`);
      const data=res?.data||res;
      setHistory(data);
    }catch(err){
      toast.error(err?.message||t('seoError'));
    }
  };

  const syncToOps=async()=>{
    try{
      await api.post('/forum/local-pricing/sync-to-ops',{});
      toast.error(t('ledgerOpsSyncUnsupported'));
    }catch(err){
      // Expected 501 until OPS adds the contract.
      toast.message(t('ledgerOpsSyncUnsupported'),{description:err?.message});
    }
  };

  if(loading)return <p className="text-sm text-muted-foreground">{t('ledgerServicesLoading')}</p>;
  if(loadError){
    return <div className="space-y-2">
      <h2 className="text-lg font-semibold">{t('ledgerServicesTableTitle')}</h2>
      <p role="alert" className="text-sm text-destructive">{loadError}</p>
      <Button variant="outline" onClick={load}>{t('ledgerHistoryRetry')}</Button>
    </div>;
  }

  const services=payload?.services||[];
  const freeMode=Boolean(payload?.freeMode);
  const opsSync=payload?.opsSync||{};
  const enrolled=Boolean(opsSync.enrolled);
  const editing=services.find(s=>s.serviceCode===detail);

  return <div className="space-y-8">
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('ledgerServicesTableTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('ledgerServicesTableIntroLocal')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={freeMode} disabled={saving} onCheckedChange={toggleFreeMode} id="free-mode"/>
            <label htmlFor="free-mode">{t('ledgerFreeModeLabel')}</label>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!enrolled||opsSync.supported===false}
            title={opsSync.supported===false?t('ledgerOpsSyncUnsupported'):undefined}
            onClick={syncToOps}
          >
            {opsSync.supported===false?t('ledgerOpsSyncUnsupportedShort'):t('ledgerOpsSyncButton')}
          </Button>
          <Link href="/dashboard/ops-connection" className="text-sm underline">{t('opsConnection')}</Link>
        </div>
      </div>

      {freeMode?(
        <p className="text-sm text-amber-700 dark:text-amber-400">{t('ledgerFreeModeHint')}</p>
      ):null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-3 font-medium">{t('ledgerSvcColService')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerSvcColForum')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerSvcColOpsOverride')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerSvcColEffective')}</th>
              <th className="p-3 font-medium">{t('ledgerSvcColStatus')}</th>
              <th className="p-3 font-medium text-right">{t('ledgerSvcColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {services.map(svc=>{
              const banned=svc.effectiveSource==='ops_ban'||svc.ops?.banned;
              const status=banned
                ?{tone:'warn',label:t('ledgerSvcStatusOpsBanned')}
                :!svc.enabled
                  ?{tone:'warn',label:t('ledgerSvcStatusDisabled')}
                  :{tone:'ok',label:t('ledgerSvcStatusAvailable')};
              const forumPrice=`${formatVnd(svc.basePriceVnd,t.locale)} · ${formatCredit(
                svc.vndPerCredit?Math.ceil(Number(svc.basePriceVnd)/Number(svc.vndPerCredit)):null,
                t.locale,
              )}`;
              const opsPrice=svc.overridePriceVnd==null?'—'
                :`${formatVnd(svc.overridePriceVnd,t.locale)} · ${formatCredit(
                  svc.vndPerCredit?Math.ceil(Number(svc.overridePriceVnd)/Number(svc.vndPerCredit)):null,
                  t.locale,
                )}`;
              const effective=banned?'—'
                :`${formatCredit(svc.effectivePriceCredit,t.locale)} (${sourceLabel(t,svc.effectiveSource)})`;
              return <tr key={svc.serviceCode} className="border-b last:border-0 align-top">
                <td className="p-3">
                  <div className="font-medium">{serviceTitle(t,svc.serviceCode)}</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">{serviceDesc(t,svc.serviceCode)}</p>
                </td>
                <td className="p-3 whitespace-pre-wrap max-w-48">{forumPrice}</td>
                <td className="p-3 whitespace-pre-wrap max-w-48">{opsPrice}</td>
                <td className="p-3 whitespace-pre-wrap max-w-52 font-medium">{effective}</td>
                <td className="p-3"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={()=>openEdit(svc)}>{t('ledgerSvcActionConfig')}</Button>
                  <Button variant="ghost" size="sm" onClick={()=>openHistory(svc.serviceCode)}>{t('ledgerSvcActionHistory')}</Button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('ledgerServicesPriceNoteLocal')}</p>
    </div>

    <LedgerRewardRules/>

    <Dialog open={Boolean(detail)} onOpenChange={open=>!open&&setDetail(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?serviceTitle(t,editing.serviceCode):t('ledgerSvcActionConfig')}</DialogTitle>
          <DialogDescription>{t('ledgerLocalConfigIntro')}</DialogDescription>
        </DialogHeader>
        {editing?(
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="text-muted-foreground">{t('ledgerLocalBasePriceVnd')}</label>
              <Input type="number" min={0} value={draft.basePriceVnd} onChange={e=>setDraft(d=>({...d,basePriceVnd:e.target.value}))}/>
            </div>
            {detail==='paid_pin'?(
              <div className="space-y-1">
                <label className="text-muted-foreground">{t('ledgerLocalDurationSeconds')}</label>
                <Input type="number" min={60} value={draft.durationSeconds} onChange={e=>setDraft(d=>({...d,durationSeconds:e.target.value}))}/>
              </div>
            ):null}
            {detail==='seo_entitlement'?(
              <div className="space-y-1">
                <label className="text-muted-foreground">{t('ledgerLocalDurationMonths')}</label>
                <Input type="number" min={1} max={36} value={draft.durationMonths} onChange={e=>setDraft(d=>({...d,durationMonths:e.target.value}))}/>
              </div>
            ):null}
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(draft.enabled)} onCheckedChange={v=>setDraft(d=>({...d,enabled:v}))}/>
              <span>{t('ledgerLocalEnabled')}</span>
            </div>
            <dl className="grid gap-2 rounded-md border p-3">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('ledgerSvcColEffective')}</dt><dd>{formatCredit(editing.effectivePriceCredit,t.locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('ledgerPriceSourceLabel')}</dt><dd>{sourceLabel(t,editing.effectiveSource)}</dd></div>
            </dl>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={saving} onClick={()=>setDetail(null)}>{t('ledgerRewardCancel')}</Button>
              <Button disabled={saving} onClick={saveService}>{t('ledgerLocalSave')}</Button>
            </div>
          </div>
        ):null}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(history)} onOpenChange={open=>!open&&setHistory(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('ledgerPriceHistoryTitle')}</DialogTitle>
          <DialogDescription>{t('ledgerPriceHistoryIntro')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2">v</th>
                <th className="py-2 pr-2">{t('ledgerSvcColForum')}</th>
                <th className="py-2">{t('ledgerPriceHistoryWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {(history?.history||[]).map(row=>(
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">{row.localPriceVersion}</td>
                  <td className="py-2 pr-2">{formatVnd(row.basePriceVnd,t.locale)}{row.enabled?'':' · off'}</td>
                  <td className="py-2">{row.createdAt?new Date(row.createdAt).toLocaleString(t.locale):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
