'use client';
import {useEffect,useState} from 'react';
import api from '@/lib/api';
import Link from '@/components/common/Link';
import {Button} from '@/components/ui/button';
import {usePbnTranslations} from '@/i18n/useTranslations';
export default function SeoActivity(){
  const t=usePbnTranslations(),[data,setData]=useState(null),[page,setPage]=useState(1),[error,setError]=useState(false);
  useEffect(()=>{setError(false);api.get('/seo/me',{page}).then(setData).catch(()=>setError(true));},[page]);
  const date=v=>new Date(v).toLocaleString(t.locale,{timeZone:'Asia/Ho_Chi_Minh'});
  const status=p=>p.status==='cancelled'?t('pinCancelled'):new Date(p.expires_at)<=new Date()?t('pinExpired'):t('pinActive');
  return <section id="seo-activity" data-testid="seo-wallet-history" className="content-card p-4 space-y-3"><h2 className="font-semibold text-lg">{t('seoWalletHistory')}</h2>{error?<p role="alert">{t('seoFailure_UNAVAILABLE')}</p>:data&&<><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('pinTopic')}</th><th>{t('seoActivityType')}</th><th>{t('seoOriginalCharge')}</th><th>{t('seoActivityTerm')}</th><th>{t('pinOperation')}</th></tr></thead><tbody>{data.purchases.map(p=><tr key={p.id} id={'seo-topic-'+p.topic_id} data-purchase-id={p.id}><td className="p-2"><Link href={'/topic/'+p.topic_id} className="underline">{p.title}</Link><div>{date(p.created_at)}</div></td><td className="p-2">{p.renewal?t('seoRenew'):t('seoActivate')}</td><td className="p-2">{p.paid_price} Credit</td><td className="p-2">{status(p)}<div>{date(p.starts_at)} → {date(p.expires_at)}</div></td><td className="p-2"><details><summary>{p.transaction_id?'#'+p.transaction_id:t('seoActivateFree')}</summary><p>{t('seoVersion')}: {p.snapshot_version}/{p.price_version}</p><p className="break-all">{p.id}</p>{data.events.filter(e=>e.purchase_id===p.id).map(e=><p key={e.id}>{t(({purchase:'seoEventPurchase',cancel:'seoEventCancel',expire:'seoEventExpire',correction:'seoEventCorrection'})[e.type]||'seoEventPurchase')} · {date(e.created_at)}</p>)}</details></td></tr>)}</tbody></table></div>{!data.purchases.length&&<p>{t('seoHistoryEmpty')}</p>}<div className="flex items-center gap-3"><Button variant="outline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{t('seoPrevious')}</Button><span>{page}</span><Button variant="outline" disabled={page*20>=data.total} onClick={()=>setPage(p=>p+1)}>{t('seoNext')}</Button></div></>}</section>;
}
