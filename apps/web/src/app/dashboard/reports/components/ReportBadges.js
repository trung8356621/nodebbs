import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
const TYPE_TEXT = (pbnT = pbnRuntimeT) => ({
  topic: pbnT("m68"),
  post: pbnT("m69"),
  user: pbnT("m70")
});
const TYPE_VARIANTS = {
  topic: 'default',
  post: 'secondary',
  user: 'outline'
};
export function getReportTypeText(type, pbnT = pbnRuntimeT) {
  return TYPE_TEXT(pbnT)[type] || type;
}
export function ReportTypeBadge({
  type
}) {
  const pbnT = usePbnTranslations();
  return <Badge variant={TYPE_VARIANTS[type] || 'secondary'} className='text-xs'>
      {getReportTypeText(type, pbnT)}
    </Badge>;
}
export function ReportStatusBadge({
  status
}) {
  const pbnT = usePbnTranslations();
  switch (status) {
    case 'pending':
      return <Badge className='bg-yellow-100 text-yellow-800 text-xs'>
          <AlertTriangle className='h-3 w-3 mr-1' />{pbnT("m443")}</Badge>;
    case 'resolved':
      return <Badge className='bg-green-100 text-green-800 text-xs'>
          <CheckCircle className='h-3 w-3 mr-1' />{pbnT("m444")}</Badge>;
    case 'dismissed':
      return <Badge className='bg-gray-100 text-gray-800 text-xs'>
          <XCircle className='h-3 w-3 mr-1' />{pbnT("m370")}</Badge>;
    default:
      return <Badge variant='secondary' className='text-xs'>{status}</Badge>;
  }
}
export function getReportTargetLink(report) {
  if (!report.targetInfo) return null;
  if (report.reportType === 'topic') {
    return `/topic/${report.targetId}`;
  } else if (report.reportType === 'post' && report.targetInfo.topicId) {
    return `/topic/${report.targetInfo.topicId}#post-${report.targetId}`;
  } else if (report.reportType === 'user') {
    return `/users/${report.targetInfo.username}`;
  }
  return null;
}
