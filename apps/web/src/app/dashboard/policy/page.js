'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
const categories=['gambling_promotion','phishing','malware','fraud','spam','custom_domain','custom_url'];
const types=['domain_exact','domain_subdomains','url_exact','url_prefix','text_signals','verify_redirect'];
const blank={category:'custom_domain',type:'domain_subdomains',value:'',action:'BLOCK',priority:0,enabled:true,reason:''};
export default function PolicyPage() {
  const t=useTranslations('policy'),locale=useLocale();
  const date=value=>value?new Date(value).toLocaleString(locale):'';
  const [data,setData]=useState(null),[search,setSearch]=useState(''),[category,setCategory]=useState(''),[type,setType]=useState(''),[rule,setRule]=useState(null),[busy,setBusy]=useState(false);
  async function load(){try{setData(await apiClient.get('/policy/'));}catch(e){toast.error(e.message);}}
  useEffect(()=>{apiClient.get('/policy/').then(setData).catch(e=>toast.error(e.message));},[]);
  async function run(fn){setBusy(true);try{await fn();toast.success(t('success'));await load();}catch(e){toast.error(e.message || t('error'));}finally{setBusy(false);}}
  const select=(value,onChange,options,label)=><label className="grid gap-1 text-sm">{label}<select aria-label={label} className="rounded-md border bg-background p-2" value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,text])=><option key={v} value={v}>{text}</option>)}</select></label>;
  const local=(data?.rules || []).filter(r=>r.scope==='local' && (!category||r.category===category) && (!type||r.type===type) && [r.value,r.reason].join(' ').toLowerCase().includes(search.toLowerCase()));
  const global=data?.versions?.find(v=>v.scope==='global');
  return <div className="space-y-6">
    <PageHeader title={t('title')} description={t('description')}/>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>run(()=>apiClient.post('/policy/sync',{}))}>{t('sync')}</Button><Button variant="outline" asChild><Link href="/dashboard/moderation">{t('queue')}</Link></Button></div>
    <section className="rounded-lg border p-4 space-y-3"><h2 className="font-semibold">{t('global')}</h2><p>{global ? `${t('version')}: ${global.version} · ${t('source')}: ${global.source} · ${t('applied')}: ${date(global.applied_at)}` : t('notConfigured')}</p><p>{t('rules')}: {(data?.rules || []).filter(r=>r.scope==='global'&&r.enabled).length}</p>
      <div className="overflow-auto"><table className="w-full min-w-[840px] text-sm"><thead><tr>{['type','value','action','reason'].map(k=><th className="p-2 text-left" key={k}>{t(k)}</th>)}</tr></thead><tbody>{data?.rules?.filter(r=>r.scope==='global').map(r=><tr key={r.id}>{[r.type,r.value,r.action,r.reason].map((v,i)=><td className={i===0||i===2?"p-2 whitespace-nowrap":"p-2 break-words max-w-80"} key={i}>{v}</td>)}</tr>)}</tbody></table></div>
    </section>
    <section className="rounded-lg border p-4 space-y-3"><div className="flex justify-between"><h2 className="font-semibold">{t('local')}</h2><Button disabled={busy} onClick={()=>setRule({...blank})}>{t('add')}</Button></div>
      <div className="flex flex-wrap gap-3"><Input aria-label={t('search')} placeholder={t('search')} value={search} onChange={e=>setSearch(e.target.value)}/>{select(category,setCategory,[['',t('all')],...categories.map(v=>[v,v])],t('category'))}{select(type,setType,[['',t('all')],...types.map(v=>[v,v])],t('type'))}</div>
      {rule && <form className="grid gap-3 rounded-md bg-muted p-4" onSubmit={e=>{e.preventDefault();run(async()=>{await apiClient.request(rule.id?'/policy/rules/'+encodeURIComponent(rule.id):'/policy/rules',{method:rule.id?'PUT':'POST',body:JSON.stringify(rule)});setRule(null);});}}>
        <p className="text-sm text-muted-foreground">{t('help')}</p>
        {select(rule.category,v=>setRule({...rule,category:v}),categories.map(v=>[v,v]),t('category'))}{select(rule.type,v=>setRule({...rule,type:v}),types.map(v=>[v,v]),t('type'))}
        <label>{t('value')}<Input required value={rule.value} onChange={e=>setRule({...rule,value:e.target.value})}/></label><label>{t('reason')}<Input required value={rule.reason} onChange={e=>setRule({...rule,reason:e.target.value})}/></label>
        {select(rule.action,v=>setRule({...rule,action:v}),[['ALLOW',t('allow')],['REVIEW',t('review')],['BLOCK',t('block')]],t('action'))}
        <label>{t('priority')}<Input type="number" min="-1000" max="1000" value={rule.priority} onChange={e=>setRule({...rule,priority:Number(e.target.value)})}/></label><label><input type="checkbox" checked={rule.enabled} onChange={e=>setRule({...rule,enabled:e.target.checked})}/> {t('enabled')}</label>
        <div className="flex gap-2"><Button disabled={busy} type="submit">{t('save')}</Button><Button variant="outline" type="button" onClick={()=>setRule(null)}>{t('cancel')}</Button></div>
      </form>}
      <div className="overflow-auto"><table className="w-full min-w-[840px] text-sm"><thead><tr>{['type','value','action','enabled','reason'].map(k=><th className="p-2 text-left" key={k}>{t(k)}</th>)}</tr></thead><tbody>{local.map(r=><tr key={r.id}>{[r.type,r.value,r.action,String(r.enabled),r.reason].map((v,i)=><td className={i===0||i===2?"p-2 whitespace-nowrap":"p-2 break-words max-w-80"} key={i}>{v}</td>)}<td className="space-x-2"><Button variant="outline" disabled={busy} onClick={()=>setRule(r)}>{t('edit')}</Button><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(t('confirm')))run(()=>apiClient.delete('/policy/rules/'+encodeURIComponent(r.id)));}}>{t('remove')}</Button></td></tr>)}</tbody></table></div>
    </section>
    <section className="rounded-lg border p-4 space-y-3"><h2 className="font-semibold">{t('scans')}</h2><div className="flex gap-2"><Button disabled={busy} onClick={()=>run(()=>apiClient.post('/policy/scans',{dryRun:true}))}>{t('dryRun')}</Button><Button variant="outline" disabled={busy} onClick={()=>run(()=>apiClient.post('/policy/scans',{dryRun:false}))}>{t('scan')}</Button></div>{data?.scans?.map(s=><p key={s.id}>#{s.id} · {s.status} · {t('progress')}: {s.scanned} / {s.affected} · {s.dry_run?t('dryRun'):t('scan')}</p>)}</section>
    <section className="rounded-lg border p-4 space-y-3"><h2 className="font-semibold">{t('syncHistory')}</h2>{data?.syncs?.map(s=><p className="text-sm break-all" key={s.id}>{date(s.created_at)} · {s.success?'✓':'✗'} · v{s.version} · {s.reason}</p>)}</section>
<section className="rounded-lg border p-4 space-y-3"><h2 className="font-semibold">{t('resolution')}</h2><div className="overflow-auto"><table className="w-full min-w-[840px] text-sm"><thead><tr>{['time','target','reviewer','resolution','reason'].map(k=><th className="p-2 text-left" key={k}>{t(k)}</th>)}</tr></thead><tbody>{data?.resolutions?.map(r=><tr key={r.id}>{[date(r.reviewed_at),r.target_type+' '+r.target_id,r.reviewed_by,r.status,r.reason].map((v,i)=><td className="p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div></section>
    <section className="rounded-lg border p-4 space-y-3"><h2 className="font-semibold">{t('audit')}</h2><div className="overflow-auto"><table className="w-full min-w-[840px] text-sm"><thead><tr>{['time','target','action','reason'].map(k=><th className="p-2 text-left" key={k}>{t(k)}</th>)}</tr></thead><tbody>{data?.decisions?.map(d=><tr key={d.id}><td className="p-2">{date(d.created_at)}</td><td className="p-2">{d.content_type} {d.content_id}</td><td className="p-2">{d.action}</td><td className="p-2">{d.reason}<br/>{d.rule_ids.join(', ')}</td></tr>)}</tbody></table></div></section>
  </div>;
}
