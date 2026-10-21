'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

/**
 * 账号注销确认弹窗 — 多步确认流程
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  loading,
  cooldownDays = 30
}) {
  const pbnT = usePbnTranslations();
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const hasPassword = user?.hasPassword !== false;
  const reset = () => {
    setStep(1);
    setPassword('');
    setConfirmText('');
    setReason('');
  };
  const handleOpenChange = val => {
    if (!val) reset();
    onOpenChange(val);
  };
  const handleConfirm = () => {
    onConfirm({
      password: hasPassword ? password : undefined,
      confirmText: hasPassword ? undefined : confirmText,
      reason: reason || undefined
    });
  };
  const isStep2Valid = hasPassword ? password.length > 0 : confirmText === 'DELETE';
  return <FormDialog open={open} onOpenChange={handleOpenChange} title={pbnT("m1045")} description={pbnT("m1046")} maxWidth="sm:max-w-125" footer={<div className="shrink-0 p-6 pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>{pbnT("m486")}</Button>
          {step === 1 ? <Button variant="destructive" onClick={() => setStep(2)}>{pbnT("m1047")}</Button> : <Button variant="destructive" onClick={handleConfirm} disabled={!isStep2Valid || loading}>
              {loading ? pbnT("m1025") : pbnT("m1048")}
            </Button>}
        </div>}>
      {step === 1 ? <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-destructive">{pbnT("m1049")}</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{pbnT("m1050")}<strong>{pbnT("m1051")}</strong></li>
                {cooldownDays > 0 ? <>
                    <li>{cooldownDays}{" "}{pbnT("m1052")}</li>
                    <li>{pbnT("m1053")}<strong>{pbnT("m1054")}</strong></li>
                  </> : <li>{pbnT("m1055")}<strong>{pbnT("m1056")}</strong></li>}
                <li>{pbnT("m1057")}</li>
              </ul>
            </div>
          </div>
        </div> : <div className="space-y-4">
          {hasPassword ? <div>
              <Label className="text-sm font-medium block mb-2">{pbnT("m1058")}</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={pbnT("m1059")} autoFocus />
            </div> : <div>
              <Label className="text-sm font-medium block mb-2">{pbnT("m1060")}<span className="font-mono font-bold">DELETE</span>{pbnT("m1061")}</Label>
              <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={pbnT("m1062")} autoFocus />
            </div>}
          <div>
            <Label className="text-sm font-medium block mb-2">{pbnT("m1063")}</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={pbnT("m1064")} rows={3} />
          </div>
        </div>}
    </FormDialog>;
}
