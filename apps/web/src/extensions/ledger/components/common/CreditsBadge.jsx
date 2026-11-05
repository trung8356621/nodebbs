import { Coins } from 'lucide-react';
import { formatCredits } from '../../utils/formatters';
import { DEFAULT_CURRENCY_CODE } from '../../constants';
import { useLedger } from '../../contexts/LedgerContext';
import { usePbnTranslations } from '@/i18n/useTranslations';
import { currencyDisplayName } from '../../utils/currencyLabels';

/**
 * Display a currency amount.
 * Prefer symbol; otherwise Coins icon + localized/technical name (never Chinese seed leftovers).
 */
export function CreditsBadge({ amount, currencyCode = DEFAULT_CURRENCY_CODE, variant = 'default', className = '' }) {
  const isLarge = variant === 'large';
  const { currencies } = useLedger();
  const pbnT = usePbnTranslations();

  const currency = currencies.find((c) => c.code === currencyCode) || { code: currencyCode };
  const symbol = currency?.symbol;
  const name = currencyDisplayName(currency, pbnT);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {symbol ? (
        <span className={isLarge ? 'text-lg' : 'text-sm'}>{symbol}</span>
      ) : (
        <Coins className={`${isLarge ? 'h-5 w-5' : 'h-4 w-4'} text-yellow-500`} />
      )}
      <span className={`${isLarge ? 'text-xl' : 'text-base'} font-bold text-yellow-600`}>
        {formatCredits(amount)}
      </span>
      {!symbol && (
        <span className={`${isLarge ? 'text-sm' : 'text-xs'} text-muted-foreground font-normal`}>
          {name}
        </span>
      )}
    </div>
  );
}
