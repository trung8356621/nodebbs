'use client';

import {usePbnTranslations} from '@/i18n/useTranslations';
import {useEffect,useMemo,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {Wallet,List as ListIcon,Coins,Store,Scale,Banknote} from 'lucide-react';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {PageHeader} from '@/components/common/PageHeader';
import {LedgerOverview} from '../../components/admin/LedgerOverview';
import {LedgerTransactions} from '../../components/admin/LedgerTransactions';
import {LedgerCurrencies} from '../../components/admin/LedgerCurrencies';
import {LedgerPaidServices} from '../../components/admin/LedgerPaidServices';
import {LedgerRewardRules} from '../../components/admin/LedgerRewardRules';
import {LedgerPayments} from '../../components/admin/LedgerPayments';

const TAB_IDS=new Set(['overview','transactions','currencies','services','reward-rules','payments']);

function normalizeTab(raw){
  // Legacy bookmark: service-history content folded into services + topic/SEO contexts.
  if(raw==='service-history')return 'services';
  return TAB_IDS.has(raw)?raw:'overview';
}

export default function LedgerAdminPage(){
  const pbnT=usePbnTranslations();
  const searchParams=useSearchParams();
  const router=useRouter();
  const initial=useMemo(()=>normalizeTab(searchParams.get('tab')),[searchParams]);
  const [tab,setTab]=useState(initial);

  useEffect(()=>{setTab(initial);},[initial]);

  const onTabChange=value=>{
    setTab(value);
    const params=new URLSearchParams(searchParams.toString());
    if(value==='overview')params.delete('tab');else params.set('tab',value);
    const qs=params.toString();
    router.replace(qs?`/dashboard/ledger?${qs}`:'/dashboard/ledger',{scroll:false});
  };

  return <div className="space-y-6">
    <PageHeader title={pbnT('m1504')} description={pbnT('ledgerAdminDescription')}/>
    <Tabs value={tab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="overview" className="gap-2"><Wallet className="h-4 w-4"/>{pbnT('m1498')}</TabsTrigger>
        <TabsTrigger value="transactions" className="gap-2"><ListIcon className="h-4 w-4"/>{pbnT('m1876')}</TabsTrigger>
        <TabsTrigger value="currencies" className="gap-2"><Coins className="h-4 w-4"/>{pbnT('m1504')}</TabsTrigger>
        <TabsTrigger value="services" className="gap-2"><Store className="h-4 w-4"/>{pbnT('ledgerTabServices')}</TabsTrigger>
        <TabsTrigger value="reward-rules" className="gap-2"><Scale className="h-4 w-4"/>{pbnT('ledgerTabRewardRules')}</TabsTrigger>
        <TabsTrigger value="payments" className="gap-2"><Banknote className="h-4 w-4"/>{pbnT('ledgerTabPayments')}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><LedgerOverview/></TabsContent>
      <TabsContent value="transactions"><LedgerTransactions/></TabsContent>
      <TabsContent value="currencies"><LedgerCurrencies/></TabsContent>
      <TabsContent value="services"><LedgerPaidServices/></TabsContent>
      <TabsContent value="reward-rules"><LedgerRewardRules/></TabsContent>
      <TabsContent value="payments"><LedgerPayments/></TabsContent>
    </Tabs>
  </div>;
}
