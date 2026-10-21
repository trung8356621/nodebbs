'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { CurrencyStats } from './CurrencyStats';
import { ledgerApi } from '../../api';
import { toast } from 'sonner';
export function LedgerOverview() {
  const pbnT = usePbnTranslations();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchData = async () => {
    try {
      const statsData = await ledgerApi.getStats();
      setStats(Array.isArray(statsData) ? statsData : statsData.items || [statsData]);
    } catch (error) {
      console.error(error);
      toast.error(pbnT("m1857"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  return <div className="space-y-6">
            <div className="space-y-8">
                {stats.map(stat => {
        const currency = stat.info;
        if (!currency) return null;
        return <div key={currency.code} className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                {currency.name} ({currency.code})
                                <span className={`text-xs px-2 py-0.5 rounded-full ${currency.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {currency.isActive ? pbnT("m1858") : pbnT("m1859")}
                                </span>
                            </h3>
                            <CurrencyStats stats={stat} loading={loading} currency={currency} />
                            <div className="border-b my-4 opacity-50"></div>
                        </div>;
      })}
            </div>
        </div>;
}
