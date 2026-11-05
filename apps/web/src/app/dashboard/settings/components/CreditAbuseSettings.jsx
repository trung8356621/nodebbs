'use client';

import {useEffect,useState} from 'react';
import {usePbnTranslations} from '@/i18n/useTranslations';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {SettingSection,SettingItem} from '@/components/common/SettingLayout';
import Link from '@/components/common/Link';
import api from '@/lib/api';
import {toast} from 'sonner';
import {formatCredit,parseVndInput} from '@/extensions/ledger/utils/money';

const LIMIT_KEYS=new Set([
  'daily_activity_reward_cap_vnd',
  'reward_min_amount',
  'reward_max_amount',
]);

/**
 * Credit limits & anti-abuse — single source: credits.config via /ledger/reward-rules.
 * Does not duplicate into system_settings.
 */
export function CreditAbuseSettings(){
  const t=usePbnTranslations();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [payload,setPayload]=useState(null);
  const [draft,setDraft]=useState({});
  const [loadError,setLoadError]=useState('');

  const load=async()=>{
    setLoading(true);setLoadError('');
    try{
      const res=await api.get('/ledger/reward-rules');
      const data=res?.data||res;
      setPayload(data);
      const next={};
      for(const rule of (data.rules||[]).filter(r=>LIMIT_KEYS.has(r.key))){
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

  const creditVnd=Number(payload?.creditVnd)||10000;
  const limits=(payload?.rules||[]).filter(r=>LIMIT_KEYS.has(r.key));

  const patchRule=async(key,updates)=>{
    setSaving(true);
    try{
      const res=await api.patch('/ledger/reward-rules',{currency:'credits',updates:{[key]:updates}});
      const data=res?.data||res;
      setPayload(data);
      const next={};
      for(const rule of (data.rules||[]).filter(r=>LIMIT_KEYS.has(r.key))){
        next[rule.key]=rule.valueVnd==null?'':String(rule.valueVnd);
      }
      setDraft(next);
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
    const rule=limits.find(r=>r.key===key);
    if(!rule?.editable){
      toast.error(t('ledgerRewardEditBlocked'));
      return;
    }
    const num=parseVndInput(draft[key]);
    if(num==null){
      toast.error(t('ledgerRewardInvalidValue',{key}));
      return;
    }
    if(num===Number(rule.valueVnd))return;
    await patchRule(key,{value:num});
  };

  if(loading)return <p className="text-sm text-muted-foreground">{t('ledgerServicesLoading')}</p>;
  if(loadError){
    return <div className="space-y-2">
      <p role="alert" className="text-sm text-destructive">{loadError}</p>
      <Button variant="outline" onClick={load}>{t('ledgerHistoryRetry')}</Button>
    </div>;
  }

  return <div className="space-y-6">
    <SettingSection description={t('creditAbuseIntro')}>
      <SettingItem
        title={t('creditAbuseSingleSourceTitle')}
        description={t('creditAbuseSingleSourceDesc')}
      >
        <Badge variant="outline">credits.config</Badge>
      </SettingItem>
      <SettingItem
        title={t('ledgerRewardRulesTitle')}
        description={t('creditAbuseRulesLinkDesc')}
      >
        <Link href="/dashboard/ledger?tab=reward-rules" className="text-sm underline">
          {t('ledgerTabRewardRules')}
        </Link>
      </SettingItem>
    </SettingSection>

    <SettingSection description={t('creditAbuseLimitsIntro')}>
      {limits.map(rule=>{
        const active=rule.runtime==='active';
        return <div key={rule.key} className="space-y-3 border-b border-border/40 pb-4 last:border-0 last:pb-0">
          <SettingItem
            title={t(`ledgerRewardKey_${rule.key}`)}
            description={<>
              <span>{t(`ledgerRewardDesc_${rule.key}`)}</span>
              <span className="block text-xs text-muted-foreground/80 mt-1">
                ≈ {formatCredit(parseVndInput(draft[rule.key])??rule.valueVnd??0,creditVnd,t.locale)}
                {' · '}
                {active
                  ?(rule.enabled?t('ledgerRewardRuntimeActive'):t('ledgerRewardRuntimeDisabled'))
                  :t('ledgerRewardRuntimeUnsupported')}
              </span>
            </>}
          >
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Input
                type="number"
                min={0}
                className="w-36"
                value={draft[rule.key]??''}
                disabled={saving||!rule.editable}
                onChange={e=>setDraft(prev=>({...prev,[rule.key]:e.target.value}))}
              />
              <span className="text-xs text-muted-foreground">VND</span>
              {rule.editable?(
                <Button size="sm" variant="outline" disabled={saving} onClick={()=>saveKey(rule.key)}>
                  {t('ledgerLocalSave')}
                </Button>
              ):null}
              {rule.toggleable&&active?(
                <Switch
                  checked={Boolean(rule.enabled)}
                  disabled={saving}
                  onCheckedChange={v=>patchRule(rule.key,{enabled:v})}
                />
              ):null}
            </div>
          </SettingItem>
        </div>;
      })}
      <p className="text-xs text-muted-foreground px-1">
        {t('ledgerRewardVndHint',{rate:creditVnd.toLocaleString(t.locale)})}
      </p>
    </SettingSection>

    <SettingSection description={t('creditAbusePolicyIntro')}>
      <SettingItem title={t('creditAbuseSelfLikeTitle')} description={t('creditAbuseSelfLikeDesc')}>
        <Badge variant="secondary">{t('creditAbusePolicyEnforced')}</Badge>
      </SettingItem>
      <SettingItem title={t('creditAbuseCheckInLimitTitle')} description={t('creditAbuseCheckInLimitDesc')}>
        <Badge variant="secondary">{t('creditAbusePolicyEnforced')}</Badge>
      </SettingItem>
      <SettingItem title={t('creditAbuseIdempotencyTitle')} description={t('creditAbuseIdempotencyDesc')}>
        <Badge variant="secondary">{t('creditAbusePolicyEnforced')}</Badge>
      </SettingItem>
      <SettingItem title={t('creditAbuseReferralTitle')} description={t('creditAbuseReferralDesc')}>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/dashboard/settings?tab=registration" className="underline">{t('m792')}</Link>
          <Link href="/dashboard/invitations" className="underline">{t('creditAbuseInviteRulesLink')}</Link>
        </div>
      </SettingItem>
      <SettingItem title={t('creditAbuseSpamTitle')} description={t('creditAbuseSpamDesc')}>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/dashboard/settings?tab=spam-protection" className="underline">{t('m800')}</Link>
          <Link href="/dashboard/settings?tab=rate-limit" className="underline">{t('m802')}</Link>
        </div>
      </SettingItem>
    </SettingSection>
  </div>;
}
