import { usePbnTranslations } from "@/i18n/useTranslations";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { formatCredits } from '../../utils/formatters';

/**
 * Display currency statistics for admin dashboard
 * @param {Object} props
 * @param {Object} props.currency - Currency definition (name, symbol, code)
 * @param {Object} props.stats - Statistics object
 * @param {boolean} props.loading - Loading state
 */
export function CurrencyStats({
  currency,
  stats,
  loading
}) {
  const pbnT = usePbnTranslations();
  if (loading || !stats) {
    return null;
  }
  const {
    name,
    symbol
  } = currency || {
    name: pbnT("m1827"),
    symbol: ''
  };
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1828")}{" "}{name}</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-1">
             {formatCredits(stats.totalCirculation)}
             <span className="text-sm font-normal text-muted-foreground">{symbol}</span>
          </div>
          <p className="text-xs text-muted-foreground">{pbnT("m1829")}{" "}{name}{" "}{pbnT("m1830")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1831")}</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
            +{formatCredits(stats.todayEarned)}
            <span className="text-sm font-normal text-muted-foreground opacity-70">{symbol}</span>
          </div>
          <p className="text-xs text-muted-foreground">{pbnT("m1832")}{" "}{name}{" "}{pbnT("m1833")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1834")}</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 flex items-center gap-1">
            -{formatCredits(stats.todaySpent)}
             <span className="text-sm font-normal text-muted-foreground opacity-70">{symbol}</span>
          </div>
          <p className="text-xs text-muted-foreground">{pbnT("m1835")}{" "}{name}{" "}{pbnT("m1833")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pbnT("m1836")}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCredits(stats.userCount)}</div>
          <p className="text-xs text-muted-foreground">{pbnT("m1837")}{" "}{name}{" "}{pbnT("m1838")}</p>
        </CardContent>
      </Card>
    </div>;
}
