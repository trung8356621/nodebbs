'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_CURRENCY_CODE } from '@/extensions/ledger/constants';

const LedgerContext = createContext(null);

// 重新导出常量，保持向后兼容
export { DEFAULT_CURRENCY_CODE };

export function LedgerProvider({ children, activeCurrencies = [] }) {
  // 直接使用 SSR 传递的数据，不进行客户端请求
  const extensions = useMemo(() => {
    const defaultCurrency = activeCurrencies.find(
      c => c.code === DEFAULT_CURRENCY_CODE && c.isActive
    );

    return {
      isRewardsEnabled: !!defaultCurrency,
      isWalletEnabled: !!defaultCurrency,
      isShopEnabled: !!defaultCurrency,
      currencies: activeCurrencies.map(c=>c.code===DEFAULT_CURRENCY_CODE?{...c,name:'Credit'}:c),
      defaultCurrency: defaultCurrency ? {...defaultCurrency,name:'Credit'} : null,
      loading: false,
    };
  }, [activeCurrencies]);

  return (
    <LedgerContext.Provider value={extensions}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error('useLedger must be used within LedgerProvider');
  }
  return context;
}

/**
 * 获取货币名称的 hook
 * @param {string} code - 货币 code，默认为 'credits'
 * @returns {string} 货币名称，如果找不到则返回 code
 */
export function useCurrencyName(code = DEFAULT_CURRENCY_CODE) {
  const { currencies, defaultCurrency } = useLedger();

  return useMemo(() => {
    // 如果是默认货币，直接使用缓存的 defaultCurrency
    if (code === DEFAULT_CURRENCY_CODE && defaultCurrency) {
      return defaultCurrency.name;
    }
    // 否则从列表中查找
    const currency = currencies.find(c => c.code === code);
    return currency?.name || code;
  }, [code, currencies, defaultCurrency]);
}

/**
 * 获取默认货币名称（简便方法）
 * @returns {string} 默认货币名称
 */
export function useDefaultCurrencyName() {
  return useCurrencyName(DEFAULT_CURRENCY_CODE);
}
