'use client';

import {useEffect,useState} from 'react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import api from '@/lib/api';
import {toast} from 'sonner';

const GROUP_ORDER=['activity_reward','activity_fee','limits','legacy_unused'];

function runtimeTone(runtime){
  if(runtime==='active')return 'default';
  if(runtime==='retired')return 'secondary';
  return 'outline';
}

function runtimeLabel(t,runtime){
  if(runtime==='active')return t('ledgerRewardRuntimeActive');
  if(runtime==='retired')return t('ledgerRewardRuntimeRetired');
  return t('ledgerRewardRuntimeUnsupported');
}

function groupLabel(t,group){
  if(group==='activity_reward')return t('ledgerRewardGroupEarn');
  if(group==='activity_fee')return t('ledgerRewardGroupSpend');
  if(group==='limits')return t('ledgerRewardGroupLimits');
  return t('ledgerRewardGroupLegacy');
}

/**
 * Load/save via /ledger/reward-rules (not ledgerApi helper) to avoid stale client exports.
 */
export function LedgerRewardRules(){
  const t=usePbnTranslations();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [payload,setPayload]=useState(null);
  const [draft,setDraft]=useState({});
  const [loadError,setLoadError]=useState('');
  const [editingKey,setEditingKey]=useState(null);

  const load=async()=>{
    setLoading(true);setLoadError('');
    try{
      const res=await api.get('/ledger/reward-rules');
      const data=res?.data||res;
      setPayload(data);
      const next={};
      for(const rule of data.rules||[]){
        next[rule.key]=rule.value==null?'':String(rule.value);
      }
      setDraft(next);
    }catch(err){
      setLoadError(err?.message||t('seoError'));
      setPayload(null);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{load();},[]);

  // Values are editable for persistence; runtime badge stays honest (retired/not wired).
  const canEdit=rule=>Boolean(rule.editable);

  const saveKey=async(key)=>{
    const rule=(payload?.rules||[]).find(r=>r.key===key);
    if(!rule||!canEdit(rule)){
      toast.error(t('ledgerRewardEditBlocked'));
      return;
    }
    const num=Number(draft[key]);
    if(!Number.isFinite(num)||!Number.isSafeInteger(num)){
      toast.error(t('ledgerRewardInvalidValue',{key}));
      return;
    }
    if(rule.min!=null&&num<rule.min){
      toast.error(t('ledgerRewardInvalidValue',{key}));
      return;
    }
    if(rule.max!=null&&num>rule.max){
      toast.error(t('ledgerRewardInvalidValue',{key}));
      return;
    }
    if(num===Number(rule.value)){
      setEditingKey(null);
      return;
    }
    setSaving(true);
    try{
      const res=await api.patch('/ledger/reward-rules',{currency:'credits',updates:{[key]:num}});
      const data=res?.data||res;
      setPayload(data);
      const next={};
      for(const r of data.rules||[]){
        next[r.key]=r.value==null?'':String(r.value);
      }
      setDraft(next);
      setEditingKey(null);
      toast.success(t('ledgerRewardSaved'));
    }catch(err){
      toast.error(err?.message||t('seoError'));
    }finally{
      setSaving(false);
    }
  };

  if(loading)return <p className="text-sm text-muted-foreground">{t('ledgerServicesLoading')}</p>;
  if(loadError){
    return <div className="space-y-2">
      <h2 className="text-lg font-semibold">{t('ledgerRewardRulesTitle')}</h2>
      <p role="alert" className="text-sm text-destructive">{loadError}</p>
      <Button variant="outline" onClick={load}>{t('ledgerHistoryRetry')}</Button>
    </div>;
  }

  const byGroup=GROUP_ORDER.map(id=>({
    id,
    rules:(payload?.rules||[]).filter(r=>r.group===id),
  })).filter(g=>g.rules.length);

  return <div className="space-y-3">
    <div>
      <h2 className="text-lg font-semibold">{t('ledgerRewardRulesTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('ledgerRewardRulesIntro')}</p>
      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{t('ledgerRewardRulesWarning')}</p>
    </div>

    {byGroup.map(group=><div key={group.id} className="space-y-2">
      <h3 className="text-sm font-semibold">{groupLabel(t,group.id)}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-3 font-medium">{t('ledgerRewardColAction')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerRewardColAmount')}</th>
              <th className="p-3 font-medium">{t('ledgerRewardColRuntime')}</th>
              <th className="p-3 font-medium text-right">{t('ledgerSvcColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {group.rules.map(rule=>{
              const editing=editingKey===rule.key;
              return <tr key={rule.key} className="border-b last:border-0 align-middle">
                <td className="p-3">
                  <div className="font-medium">{t(`ledgerRewardKey_${rule.key}`)}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`ledgerRewardDesc_${rule.key}`)}</p>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {editing?(
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28"
                        value={draft[rule.key]??''}
                        disabled={saving}
                        onChange={e=>setDraft(prev=>({...prev,[rule.key]:e.target.value}))}
                      />
                      <span className="text-xs text-muted-foreground">{t('ledgerRewardUnitCredit')}</span>
                    </div>
                  ):(
                    <span>{draft[rule.key]===''||draft[rule.key]==null?'—':`${draft[rule.key]} ${t('ledgerRewardUnitCredit')}`}</span>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant={runtimeTone(rule.runtime)}>{runtimeLabel(t,rule.runtime)}</Badge>
                </td>
                <td className="p-3 text-right">
                  {canEdit(rule)?(
                    editing?(
                      <div className="inline-flex gap-2">
                        <Button size="sm" disabled={saving} onClick={()=>saveKey(rule.key)}>{t('ledgerRewardSave')}</Button>
                        <Button size="sm" variant="ghost" disabled={saving} onClick={()=>{
                          setDraft(prev=>({...prev,[rule.key]:rule.value==null?'':String(rule.value)}));
                          setEditingKey(null);
                        }}>{t('ledgerRewardCancel')}</Button>
                      </div>
                    ):(
                      <Button size="sm" variant="outline" onClick={()=>setEditingKey(rule.key)}>{t('m235')}</Button>
                    )
                  ):(
                    <span className="text-xs text-muted-foreground">{t('ledgerRewardReadOnly')}</span>
                  )}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>)}
  </div>;
}
