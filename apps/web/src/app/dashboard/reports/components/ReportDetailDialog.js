import { usePbnTranslations } from "@/i18n/useTranslations";
import { FormDialog } from '@/components/common/FormDialog';
import { Label } from '@/components/ui/label';
import Link from '@/components/common/Link';
import Time from '@/components/common/Time';
import { ReportTypeBadge, ReportStatusBadge, getReportTargetLink } from './ReportBadges';
export function ReportDetailDialog({
  open,
  onOpenChange,
  report
}) {
  const pbnT = usePbnTranslations();
  return <FormDialog open={open} onOpenChange={onOpenChange} title={pbnT("m445")} cancelText={pbnT("m446")} maxWidth='sm:max-w-150'>
      {report && <div className='space-y-4 py-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='text-muted-foreground'>{pbnT("m447")}</Label>
              <p className='font-mono'>#{report.id}</p>
            </div>
            <div>
              <Label className='text-muted-foreground'>{pbnT("m406")}</Label>
              <div className='mt-1'><ReportTypeBadge type={report.reportType} /></div>
            </div>
            <div>
              <Label className='text-muted-foreground'>{pbnT("m298")}</Label>
              <div className='mt-1'><ReportStatusBadge status={report.status} /></div>
            </div>
            <div>
              <Label className='text-muted-foreground'>{pbnT("m448")}</Label>
              <p>{report.reporterName || report.reporterUsername}</p>
            </div>
          </div>

          <div>
            <Label className='text-muted-foreground'>{pbnT("m449")}</Label>
            <p>
              <Time date={report.createdAt} />
            </p>
          </div>

          <div>
            <Label className='text-muted-foreground'>{pbnT("m450")}</Label>
            <p className='mt-1 p-3 bg-muted rounded text-sm'>
              {report.reason}
            </p>
          </div>

          {report.targetInfo && <div>
              <Label className='text-muted-foreground'>{pbnT("m451")}</Label>
              <div className='mt-1 p-3 bg-muted rounded text-sm'>
                {report.reportType === 'topic' && <div>
                    <p className='font-medium'>{report.targetInfo.title}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{pbnT("m452")}{" "}{report.targetInfo.username}
                    </p>
                  </div>}
                {report.reportType === 'post' && <div>
                    <p>{report.targetInfo.content}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{pbnT("m452")}{" "}{report.targetInfo.username}
                    </p>
                  </div>}
                {report.reportType === 'user' && <div>
                    <p className='font-medium'>
                      {report.targetInfo.username}
                    </p>
                    {report.targetInfo.name && <p className='text-xs text-muted-foreground mt-1'>
                        {report.targetInfo.name}
                      </p>}
                  </div>}
              </div>
              {getReportTargetLink(report) && <Link href={getReportTargetLink(report)} target='_blank' className='text-sm text-primary hover:underline mt-2 inline-block'>{pbnT("m453")}</Link>}
            </div>}

          {report.status !== 'pending' && <>
              <div>
                <Label className='text-muted-foreground'>{pbnT("m454")}</Label>
                <p>{report.resolverUsername || `#${report.resolvedBy}`}</p>
              </div>
              <div>
                <Label className='text-muted-foreground'>{pbnT("m455")}</Label>
                <p>
                  <Time date={report.resolvedAt} />
                </p>
              </div>
              {report.resolverNote && <div>
                  <Label className='text-muted-foreground'>{pbnT("m456")}</Label>
                  <p className='mt-1 p-3 bg-muted rounded text-sm'>
                    {report.resolverNote}
                  </p>
                </div>}
            </>}
        </div>}
    </FormDialog>;
}
