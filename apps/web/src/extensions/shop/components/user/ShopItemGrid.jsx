import { usePbnTranslations } from "@/i18n/useTranslations";
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { Loading } from '@/components/common/Loading';
import { ShopItemCard } from './ShopItemCard';

/**
 * Grid layout of shop items
 * @param {Object} props
 * @param {Array} props.items - Array of shop items
 * @param {Array} props.items - Array of shop items
 * @param {Array} props.accounts - User's accounts list
 * @param {Function} props.onPurchase - Callback when purchase button clicked
 * @param {boolean} props.isAuthenticated - Whether user is authenticated
 * @param {boolean} props.loading - Loading state
 */
export function ShopItemGrid({
  items,
  accounts = [],
  onPurchase,
  isAuthenticated,
  loading
}) {
  const pbnT = usePbnTranslations();
  if (loading) {
    return <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:grid-cols-5">
        {Array.from({
        length: 8
      }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/20 animate-pulse border border-border/50" />)}
      </div>;
  }
  if (items.length === 0) {
    return <Card className="shadow-none">
        <CardContent className="text-center py-12">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">{pbnT("m2021")}</h3>
          <p className="text-muted-foreground">{pbnT("m2022")}</p>
        </CardContent>
      </Card>;
  }
  return <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map(item => {
      const balance = accounts.find(a => a.currency.code === item.currencyCode)?.balance || 0;
      return <ShopItemCard key={item.id} item={item} userBalance={balance} onPurchase={onPurchase} isAuthenticated={isAuthenticated} />;
    })}
    </div>;
}
