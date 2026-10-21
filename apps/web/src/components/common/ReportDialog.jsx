'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { moderationApi } from '@/lib/api';
import { toast } from 'sonner';
export default function ReportDialog({
  open,
  onOpenChange,
  reportType,
  targetId,
  targetTitle
}) {
  const pbnT = usePbnTranslations();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error(pbnT("m1473"));
      return;
    }
    setSubmitting(true);
    try {
      await moderationApi.createReport(reportType, targetId, reason.trim());
      toast.success(pbnT("m1474"));
      setReason('');
      onOpenChange(false);
    } catch (err) {
      console.error("Could not report:", err);
      toast.error(err.message || pbnT("m1476"));
    } finally {
      setSubmitting(false);
    }
  };
  const getTypeText = () => {
    switch (reportType) {
      case 'topic':
        return pbnT("m68");
      case 'post':
        return pbnT("m69");
      case 'user':
        return pbnT("m70");
      default:
        return pbnT("m353");
    }
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={<div className='flex items-center space-x-2'>
          <AlertTriangle className='h-5 w-5 text-orange-500' />
          <span>{pbnT("m1477")}{" "}{getTypeText()}</span>
        </div>} description={targetTitle && <span className='block mt-2 p-2 bg-muted rounded text-sm'>
            {getTypeText()}：{targetTitle}
            </span>} submitText={pbnT("m1478")} onSubmit={handleSubmit} loading={submitting} submitClassName="bg-orange-500 hover:bg-orange-600" disabled={submitting || reason.trim().length < 10} maxWidth="sm:max-w-125">
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='reason'>{pbnT("m1479")}</Label>
            <Textarea id='reason' placeholder={pbnT("m1480")} value={reason} onChange={e => setReason(e.target.value)} disabled={submitting} className='min-h-30' maxLength={500} />
            <div className='text-xs text-muted-foreground text-right'>
              {reason.length}/500
            </div>
          </div>

          <div className='text-sm text-muted-foreground bg-muted p-3 rounded'>
            <p className='font-medium mb-1'>{pbnT("m1481")}</p>
            <ul className='list-disc list-inside space-y-1 text-xs'>
              <li>{pbnT("m1482")}</li>
              <li>{pbnT("m1483")}</li>
              <li>{pbnT("m1484")}</li>
            </ul>
          </div>
        </div>
    </FormDialog>;
}
