'use client';

import {useEffect,useState} from 'react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import Link from '@/components/common/Link';
import api from '@/lib/api';
import {toast} from 'sonner';
import {formatCredit,formatVnd,parseVndInput} from '../../utils/money';

/** Earn/spend only — limits live in Settings; legacy keys are hidden from admin UI. */
const GROUP_ORDER=['activity_reward','activity_fee'];

function runtimeTone(runtime,enabled){
  if(runtime==='active'&&enabled)return 'default';
  if(runtime==='active'&&!enabled)return 'secondary';
  if(runtime==='unsupported'||runtime==='retired')return 'outline';
  return 'outline';
}

function runtimeLabel(t,rule){
  if(rule.runtime==='unsupported'||rule.runtime==='retired'){
    return t('ledgerRewardRuntimeUnsupported');
  }
  if(rule.runtime==='active'){
    return rule.enabled?t('ledgerRewardRuntimeActive'):t('ledgerRewardRuntimeDisabled');
  }
  return t('ledgerRewardRuntimeUnsupported');
}

function groupLabel(t,group){
  if(group==='activity_reward')return t('ledgerRewardGroupEarn');
  if(group==='activity_fee')return t('ledgerRewardGroupSpend');
  return group;
}

/**
 * Admin configures VND values for live earn/spend actions.
 * Limits & anti-abuse: Settings → Credit & chống lạm dụng (same credits.config).
 */
export function LedgerRewardRules({vndPerCredit:vndPerCreditProp}={}){
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
        next[rule.key]=rule.valueVnd==null?'':String(rule.valueVnd);
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

  const creditVnd=Number(payload?.creditVnd||vndPerCreditProp)||10000;
  const canEdit=rule=>Boolean(rule.editable)&&rule.runtime==='active';

  const patchRule=async(key,updates)=>{
    setSaving(true);
    try{
      const res=await api.patch('/ledger/reward-rules',{currency:'credits',updates:{[key]:updates}});
      const data=res?.data||res;
      setPayload(data);
      const next={};
      for(const r of data.rules||[]){
        next[r.key]=r.valueVnd==null?'':String(r.valueVnd);
      }
      setDraft(next);
      setEditingKey(null);
      toast.success(t('ledgerRewardSaved'));
      return true;
    }catch(err){
      toast.error(err?.message||t('seoError'));
      return false;
    }finally{
      setSaving(false);
    }
  };

  const saveKey=async(key)=>{
    const rule=(payload?.rules||[]).find(r=>r.key===key);
    if(!rule||!canEdit(rule)){
      toast.error(t('ledgerRewardEditBlocked'));
      return;
    }
    const num=parseVndInput(draft[key]);
    if(num==null){
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
    if(num===Number(rule.valueVnd)){
      setEditingKey(null);
      return;
    }
    await patchRule(key,{value:num});
  };

  const toggleEnabled=async(rule,enabled)=>{
    if(!rule.toggleable||rule.runtime!=='active'){
      toast.error(t('ledgerRewardEditBlocked'));
      return;
    }
    const ok=await patchRule(rule.key,{enabled});
    if(!ok)await load();
  };

  if(loading)return <p className="text-sm text-muted-foreground">{t('ledgerServicesLoading')}</p>;
  if(loadError){
    return <div className="space-y-2">
      <h2 className="text-lg font-semibold">{t('ledgerRewardRulesTitle')}</h2>
      <p role="alert" className="text-sm text-destructive">{loadError}</p>
      <Button variant="outline" onClick={load}>{t('ledgerHistoryRetry')}</Button>
    </div>;
  }

  const visibleRules=(payload?.rules||[]).filter(r=>GROUP_ORDER.includes(r.group));
  const byGroup=GROUP_ORDER.map(id=>({
    id,
    rules:visibleRules.filter(r=>r.group===id),
  })).filter(g=>g.rules.length);

  return <div className="space-y-3">
    <div>
      <h2 className="text-lg font-semibold">{t('ledgerRewardRulesTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('ledgerRewardRulesIntro')}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {t('ledgerRewardVndHint',{rate:creditVnd.toLocaleString(t.locale)})}
      </p>
      <p className="text-xs mt-2">
        <Link href="/dashboard/settings?tab=credit-abuse" className="underline text-muted-foreground hover:text-foreground">
          {t('ledgerRewardLimitsSettingsLink')}
        </Link>
      </p>
    </div>

    {byGroup.map(group=><div key={group.id} className="space-y-2">
      <h3 className="text-sm font-semibold">{groupLabel(t,group.id)}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-3 font-medium">{t('ledgerRewardColAction')}</th>
              <th className="p-3 font-medium whitespace-nowrap">{t('ledgerRewardColAmountVnd')}</th>
              <th className="p-3 font-medium">{t('ledgerRewardColEnabled')}</th>
              <th className="p-3 font-medium">{t('ledgerRewardColRuntime')}</th>
              <th className="p-3 font-medium text-right">{t('ledgerSvcColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {group.rules.map(rule=>{
              const editing=editingKey===rule.key;
              const unsupported=rule.runtime==='unsupported'||rule.runtime==='retired';
              return <tr key={rule.key} className="border-b last:border-0 align-middle">
                <td className="p-3">
                  <div className="font-medium">{t(`ledgerRewardKey_${rule.key}`)}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(`ledgerRewardDesc_${rule.key}`)}</p>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {editing?(
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-36"
                          value={draft[rule.key]??''}
                          disabled={saving}
                          onChange={e=>setDraft(prev=>({...prev,[rule.key]:e.target.value}))}
                        />
                        <span className="text-xs text-muted-foreground">VND</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatCredit(parseVndInput(draft[rule.key])??0,creditVnd,t.locale)}
                      </p>
                    </div>
                  ):(
                    <div>
                      <div>{formatVnd(rule.valueVnd,t.locale)}</div>
                      <div className="text-xs text-muted-foreground">
                        ≈ {formatCredit(rule.valueVnd,creditVnd,t.locale)}
                      </div>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {rule.toggleable&&!unsupported?(
                    <Switch
                      checked={Boolean(rule.enabled)}
                      disabled={saving}
                      onCheckedChange={v=>toggleEnabled(rule,v)}
                    />
                  ):(
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant={runtimeTone(rule.runtime,rule.enabled)}>
                    {runtimeLabel(t,rule)}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  {canEdit(rule)?(
                    editing?(
                      <div className="inline-flex gap-2">
                        <Button size="sm" disabled={saving} onClick={()=>saveKey(rule.key)}>{t('ledgerRewardSave')}</Button>
                        <Button size="sm" variant="ghost" disabled={saving} onClick={()=>{
                          setDraft(prev=>({...prev,[rule.key]:rule.valueVnd==null?'':String(rule.valueVnd)}));
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
