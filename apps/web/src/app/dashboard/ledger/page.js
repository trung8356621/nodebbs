'use client';

import {Suspense} from 'react';
import LedgerAdminPage from '@/extensions/ledger/pages/admin/LedgerAdminPage';
import {Loading} from '@/components/common/Loading';

export default function LedgerDashboardPage(){
  return <Suspense fallback={<Loading className="min-h-40"/>}>
    <LedgerAdminPage/>
  </Suspense>;
}
