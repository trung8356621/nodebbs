import { usePbnTranslations } from "@/i18n/useTranslations";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCredits } from '../../utils/formatters';

/**
 * Detailed balance overview with earned/spent stats
 * @param {Object} props
 * @param {Object} props.balance - Balance object with balance, totalEarned, totalSpent
 */
export function BalanceOverview({
  balance
}) {
  const pbnT = usePbnTranslations();
  if (!balance) return null;
  return <div className="grid gap-4 md:grid-cols-3">
      {/* Current Balance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1883")}</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCredits(balance.balance || 0)}</div>
          <p className="text-xs text-muted-foreground">{pbnT("m1884")}</p>
        </CardContent>
      </Card>

      {/* Total Earned */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1885")}</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCredits(balance.totalEarned || 0)}</div>
          <p className="text-xs text-muted-foreground">{pbnT("m1886")}</p>
        </CardContent>
      </Card>

      {/* Total Spent */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1887")}</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCredits(balance.totalSpent || 0)}</div>
          <p className="text-xs text-muted-foreground">{pbnT("m1888")}</p>
        </CardContent>
      </Card>
    </div>;
}
