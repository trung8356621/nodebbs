import { usePbnTranslations } from "@/i18n/useTranslations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import Time from '@/components/common/Time';

/**
 * Display check-in streak and last check-in
 * @param {Object} props
 * @param {number} props.checkInStreak - Current check-in streak
 * @param {string} props.lastCheckInDate - Last check-in date (ISO string)
 */
export function CheckInStatus({
  checkInStreak,
  lastCheckInDate
}) {
  const pbnT = usePbnTranslations();
  return <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />{pbnT("m1889")}</CardTitle>
        <CardDescription>{pbnT("m1890")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{pbnT("m1891")}</span>
            <span className="text-2xl font-bold">{checkInStreak || 0}{" "}{pbnT("m336")}</span>
          </div>
          {lastCheckInDate && <div className="flex flex-col border-l pl-4">
              <span className="text-sm text-muted-foreground">{pbnT("m1892")}</span>
              <span className="text-sm font-medium">
                <Time date={lastCheckInDate} fromNow />
              </span>
            </div>}
        </div>
      </CardContent>
    </Card>;
}
