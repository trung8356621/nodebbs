'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { FormDialog } from '@/components/common/FormDialog';
import { Loader2, CheckCircle2 } from 'lucide-react';

/**
 * 邮箱修改对话框
 * 接收 emailChange Hook 实例
 */
export function EmailChangeDialog({
  open,
  onOpenChange,
  emailChange
}) {
  const pbnT = usePbnTranslations();
  const {
    user,
    settings,
    step: emailStep,
    setStep: onStepChange,
    formData: emailData,
    setFormData: onEmailDataChange,
    sendOldEmailCode: onSendOldEmailCode,
    sendNewEmailCode: onSendNewEmailCode,
    handleSubmit: onSubmitEmailChange,
    loading,
    closeDialog
  } = emailChange;
  const handleClose = () => {
    closeDialog();
  };
  const getStepDescription = () => {
    switch (emailStep) {
      case 1:
        return pbnT("m1065");
      case 2:
        return pbnT("m1066");
      case 3:
        return pbnT("m1067");
      default:
        return '';
    }
  };
  const getButtonText = () => {
    if (loading) {
      switch (emailStep) {
        case 1:
          return emailData.oldEmailCodeSent ? pbnT("m1024") : pbnT("m615");
        case 2:
          return emailData.newEmailCodeSent ? pbnT("m1024") : pbnT("m615");
        case 3:
          return pbnT("m94");
        default:
          return pbnT("m1025");
      }
    }
    switch (emailStep) {
      case 1:
        return emailData.oldEmailCodeSent ? pbnT("m1024") : pbnT("m1026");
      case 2:
        return emailData.newEmailCodeSent ? pbnT("m1024") : pbnT("m1026");
      case 3:
        return pbnT("m869");
      default:
        return pbnT("m1028");
    }
  };
  const handleNextStep = () => {
    switch (emailStep) {
      case 1:
        if (!emailData.oldEmailCodeSent) {
          onSendOldEmailCode();
        } else {
          if (!emailData.oldEmailCode.trim()) {
            return;
          }
          onStepChange(2);
        }
        break;
      case 2:
        if (!emailData.newEmailCodeSent) {
          onSendNewEmailCode();
        } else {
          if (!emailData.newEmailCode.trim()) {
            return;
          }
          onStepChange(3);
        }
        break;
      case 3:
        onSubmitEmailChange();
        break;
      default:
        break;
    }
  };
  const canProceedToNextStep = () => {
    switch (emailStep) {
      case 1:
        return emailData.oldEmailCodeSent && emailData.oldEmailCode.trim();
      case 2:
        return emailData.newEmail.trim() && emailData.newEmailCodeSent && emailData.newEmailCode.trim();
      case 3:
        return settings.email_change_requires_password?.value ? emailData.password.trim() : true;
      default:
        return false;
    }
  };
  return <FormDialog open={open} onOpenChange={open => {
    if (!open) {
      handleClose();
    } else {
      onOpenChange(true);
    }
  }} title={pbnT("m1068")} description={getStepDescription()} maxWidth="sm:max-w-125" footer={<DialogFooter className="shrink-0 p-6 pt-4">
          <Button variant='outline' onClick={() => {
      if (emailStep === 1 || emailStep === 2 && user?.isEmailVerified === false) {
        handleClose();
      } else if (emailStep === 2 && emailData.newEmailCodeSent) {
        onEmailDataChange({
          ...emailData,
          newEmailCodeSent: false,
          newEmailCode: ''
        });
      } else {
        onStepChange(emailStep - 1);
      }
    }} disabled={loading}>
            {emailStep === 1 || emailStep === 2 && user?.isEmailVerified === false ? pbnT("m486") : pbnT("m1030")}
          </Button>
          <Button onClick={handleNextStep} disabled={loading || emailStep === 1 && emailData.oldEmailCodeSent && !emailData.oldEmailCode.trim() || emailStep === 2 && emailData.newEmailCodeSent && !emailData.newEmailCode.trim()}>
            {loading ? <>
                <Loader2 className='h-4 w-4 animate-spin' />
                {getButtonText()}
              </> : getButtonText()}
          </Button>
        </DialogFooter>}>
        <div className='space-y-4 py-4'>
          {/* 步骤指示器 */}
          <div className='flex items-center justify-center space-x-2 pb-2'>
            {(user?.isEmailVerified === false ? [2, 3] : [1, 2, 3]).map((step, index, arr) => <div key={step} className='flex items-center'>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${emailStep === step ? 'bg-primary text-primary-foreground' : emailStep > step ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {emailStep > step ? <CheckCircle2 className='h-4 w-4' /> : index + 1}
                </div>
                {index < arr.length - 1 && <div className={`w-12 h-0.5 ${emailStep > step ? 'bg-green-500' : 'bg-muted'}`} />}
              </div>)}
          </div>

          {/* 步骤 1：验证旧邮箱 */}
          {emailStep === 1 && <>
              <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1069")}</Label>
                <Input value={user?.email} disabled className='bg-muted' />
              </div>

              {!emailData.oldEmailCodeSent ? <p className='text-sm text-muted-foreground'>{pbnT("m1070")}</p> : <div>
                  <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1033")}</Label>
                  <Input value={emailData.oldEmailCode} onChange={e => onEmailDataChange({
            ...emailData,
            oldEmailCode: e.target.value
          })} placeholder={pbnT("m1034")} maxLength={6} disabled={loading} onKeyPress={e => e.key === 'Enter' && canProceedToNextStep() && handleNextStep()} />
                  <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1071")}{" "}{user?.email}
                  </p>
                </div>}
            </>}

          {/* 步骤 2：输入新邮箱并验证 */}
          {emailStep === 2 && <>
              <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1072")}</Label>
                <Input type='email' value={emailData.newEmail} onChange={e => onEmailDataChange({
            ...emailData,
            newEmail: e.target.value
          })} placeholder={pbnT("m1073")} disabled={loading || emailData.newEmailCodeSent} />
              </div>

              {emailData.newEmailCodeSent && <>
                  <div className='p-4 bg-muted rounded-lg'>
                    <p className='text-sm text-muted-foreground'>{pbnT("m1032")}<span className='font-medium text-card-foreground'>{emailData.newEmail}</span>
                    </p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1033")}</Label>
                    <Input value={emailData.newEmailCode} onChange={e => onEmailDataChange({
              ...emailData,
              newEmailCode: e.target.value
            })} placeholder={pbnT("m1034")} maxLength={6} disabled={loading} onKeyPress={e => e.key === 'Enter' && canProceedToNextStep() && handleNextStep()} />
                  </div>
                </>}
            </>}

          {/* 步骤 3：输入密码并确认 */}
          {emailStep === 3 && <>
              <div className='p-4 bg-muted rounded-lg space-y-2'>
                <p className='text-sm font-medium text-card-foreground'>{pbnT("m1035")}</p>
                <div className='text-sm text-muted-foreground space-y-1'>
                  <p>{pbnT("m1074")}{" "}{user?.email}</p>
                  <p>{pbnT("m1075")}{" "}{emailData.newEmail}</p>
                </div>
              </div>

              {settings.email_change_requires_password?.value && <div>
                  <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1037")}</Label>
                  <Input type='password' value={emailData.password} onChange={e => onEmailDataChange({
            ...emailData,
            password: e.target.value
          })} placeholder={pbnT("m1076")} disabled={loading} onKeyPress={e => e.key === 'Enter' && canProceedToNextStep() && handleNextStep()} />
                  <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1039")}</p>
                </div>}
            </>}
        </div>
    </FormDialog>;
}
