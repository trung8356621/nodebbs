import { getPbnTranslations } from "@/i18n/server";
import { request, getCurrentUser } from '@/lib/server/api';
import { getDefaultCurrencyName } from '@/extensions/ledger/server';
import { RankView } from '@/modules/forum/ui';
export async function generateMetadata() {
  const pbnT = await getPbnTranslations();
  return {
    title: pbnT("m64"),
    description: pbnT("m65")
  };
}
export default async function RankPage({
  searchParams
}) {
  const pbnT = await getPbnTranslations();
  const {
    type
  } = await searchParams;
  const rankType = type || 'balance';
  const [currentUser, currencyName, rankData] = await Promise.all([getCurrentUser(pbnT), getDefaultCurrencyName(pbnT), request(`/rewards/rank?limit=50&type=${rankType}`, undefined, pbnT).catch(e => {
    console.error("Fetch ranking failed", e);
    return {
      items: []
    };
  })]);
  const ranking = rankData?.items || [];
  return <RankView rankType={rankType} currentUserId={currentUser?.id} currencyName={currencyName} ranking={ranking} />;
}
