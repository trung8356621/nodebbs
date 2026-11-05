import {redirect} from 'next/navigation';
import {LedgerServiceHistory} from '@/extensions/ledger/components/admin/LedgerServiceHistory';

/**
 * Legacy SEO admin URL.
 * Catalog/config → ledger services. Purchase history remains readable here.
 */
export default async function LegacySeoAdmin({searchParams}){
  const params=await searchParams;
  if(params?.tab==='history'){
    return <div className="space-y-4 p-1">
      <LedgerServiceHistory/>
    </div>;
  }
  redirect('/dashboard/ledger?tab=services');
}
