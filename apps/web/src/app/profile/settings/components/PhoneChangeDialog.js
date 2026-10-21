'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { FormDialog } from '@/components/common/FormDialog';
import { Loader2, CheckCircle2 } from 'lucide-react';

/**
 * 手机号修改对话框
 * 接收 phoneChange Hook 实例
 */
export function PhoneChangeDialog({
  open,
  onOpenChange,
  phoneChange
}) {
  const pbnT = usePbnTranslations();
  const {
    user,
    settings,
    step: phoneStep,
    setStep: onStepChange,
    formData: phoneData,
    setFormData: onPhoneDataChange,
    sendOldPhoneCode: onSendOldPhoneCode,
    sendNewPhoneCode: onSendNewPhoneCode,
    handleSubmit: onSubmitPhoneChange,
    loading,
    closeDialog
  } = phoneChange;
  const handleClose = () => {
    closeDialog();
  };

  // 判断是否需要密码步骤
  const needsPasswordStep = settings.phone_change_requires_password?.value && user?.hasPassword;
  const totalSteps = needsPasswordStep ? 3 : 2;
  const getStepDescription = () => {
    switch (phoneStep) {
      case 1:
        return pbnT("m1085");
      case 2:
        return pbnT("m1086");
      case 3:
        return pbnT("m1067");
      default:
        return '';
    }
  };
  const getButtonText = () => {
    if (loading) {
      switch (phoneStep) {
        case 1:
          return phoneData.oldPhoneCodeSent ? pbnT("m1024") : pbnT("m615");
        case 2:
          return phoneData.newPhoneCodeSent ? phoneStep === totalSteps ? pbnT("m869") : pbnT("m1024") : pbnT("m615");
        case 3:
          return pbnT("m94");
        default:
          return pbnT("m1025");
      }
    }
    switch (phoneStep) {
      case 1:
        return phoneData.oldPhoneCodeSent ? pbnT("m1024") : pbnT("m1026");
      case 2:
        return phoneData.newPhoneCodeSent ? phoneStep === totalSteps ? pbnT("m869") : pbnT("m1024") : pbnT("m1026");
      case 3:
        return pbnT("m869");
      default:
        return pbnT("m1028");
    }
  };
  const handleNextStep = () => {
    switch (phoneStep) {
      case 1:
        if (!phoneData.oldPhoneCodeSent) {
          onSendOldPhoneCode();
        } else {
          if (!phoneData.oldPhoneCode.trim()) {
            return;
          }
          onStepChange(2);
        }
        break;
      case 2:
        if (!phoneData.newPhoneCodeSent) {
          onSendNewPhoneCode();
        } else {
          if (!phoneData.newPhoneCode.trim()) {
            return;
          }
          if (needsPasswordStep) {
            onStepChange(3);
          } else {
            onSubmitPhoneChange();
          }
        }
        break;
      case 3:
        onSubmitPhoneChange();
        break;
      default:
        break;
    }
  };
  const isButtonDisabled = () => {
    if (loading) return true;
    switch (phoneStep) {
      case 1:
        return phoneData.oldPhoneCodeSent && !phoneData.oldPhoneCode.trim();
      case 2:
        if (!phoneData.newPhoneCodeSent) return !phoneData.newPhone.trim();
        return !phoneData.newPhoneCode.trim();
      case 3:
        return !phoneData.password.trim();
      default:
        return false;
    }
  };

  // 格式化手机号显示（隐藏中间4位）
  const maskedPhone = user?.phone ? user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '';
  return <FormDialog open={open} onOpenChange={open => {
    if (!open) {
      handleClose();
    } else {
      onOpenChange(true);
    }
  }} title={pbnT("m1087")} description={getStepDescription()} maxWidth="sm:max-w-125" footer={<DialogFooter className="shrink-0 p-6 pt-4">
          <Button variant='outline' onClick={() => {
      if (phoneStep === 1) {
        handleClose();
      } else if (phoneStep === 2 && phoneData.newPhoneCodeSent) {
        onPhoneDataChange({
          ...phoneData,
          newPhoneCodeSent: false,
          newPhoneCode: ''
        });
      } else {
        onStepChange(phoneStep - 1);
      }
    }} disabled={loading}>
            {phoneStep === 1 ? pbnT("m486") : pbnT("m1030")}
          </Button>
          <Button onClick={handleNextStep} disabled={isButtonDisabled()}>
            {loading ? <>
                <Loader2 className='h-4 w-4 animate-spin' />
                {getButtonText()}
              </> : getButtonText()}
          </Button>
        </DialogFooter>}>
        <div className='space-y-4 py-4'>
          {/* 步骤指示器 */}
          <div className='flex items-center justify-center space-x-2 pb-2'>
            {Array.from({
          length: totalSteps
        }, (_, i) => i + 1).map(step => <div key={step} className='flex items-center'>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${phoneStep === step ? 'bg-primary text-primary-foreground' : phoneStep > step ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {phoneStep > step ? <CheckCircle2 className='h-4 w-4' /> : step}
                </div>
                {step < totalSteps && <div className={`w-12 h-0.5 ${phoneStep > step ? 'bg-green-500' : 'bg-muted'}`} />}
              </div>)}
          </div>

          {/* 步骤 1：验证旧手机号 */}
          {phoneStep === 1 && <>
              <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1088")}</Label>
                <Input value={maskedPhone} disabled className='bg-muted' />
              </div>

              {!phoneData.oldPhoneCodeSent ? <p className='text-sm text-muted-foreground'>{pbnT("m1089")}</p> : <div>
                  <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1033")}</Label>
                  <Input value={phoneData.oldPhoneCode} onChange={e => onPhoneDataChange({
            ...phoneData,
            oldPhoneCode: e.target.value
          })} placeholder={pbnT("m1034")} maxLength={6} disabled={loading} onKeyDown={e => e.key === 'Enter' && !isButtonDisabled() && handleNextStep()} />
                  <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1071")}{" "}{maskedPhone}
                  </p>
                </div>}
            </>}

          {/* 步骤 2：输入新手机号并验证 */}
          {phoneStep === 2 && <>
              <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1090")}</Label>
                <Input type='tel' value={phoneData.newPhone} onChange={e => onPhoneDataChange({
            ...phoneData,
            newPhone: e.target.value
          })} placeholder={pbnT("m1091")} maxLength={11} disabled={loading || phoneData.newPhoneCodeSent} />
              </div>

              {phoneData.newPhoneCodeSent && <>
                  <div className='p-4 bg-muted rounded-lg'>
                    <p className='text-sm text-muted-foreground'>{pbnT("m1032")}<span className='font-medium text-card-foreground'>{phoneData.newPhone}</span>
                    </p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1033")}</Label>
                    <Input value={phoneData.newPhoneCode} onChange={e => onPhoneDataChange({
              ...phoneData,
              newPhoneCode: e.target.value
            })} placeholder={pbnT("m1034")} maxLength={6} disabled={loading} onKeyDown={e => e.key === 'Enter' && !isButtonDisabled() && handleNextStep()} />
                  </div>
                </>}
            </>}

          {/* 步骤 3：输入密码并确认（仅当需要密码验证时） */}
          {phoneStep === 3 && <>
              <div className='p-4 bg-muted rounded-lg space-y-2'>
                <p className='text-sm font-medium text-card-foreground'>{pbnT("m1035")}</p>
                <div className='text-sm text-muted-foreground space-y-1'>
                  <p>{pbnT("m1092")}{" "}{maskedPhone}</p>
                  <p>{pbnT("m1093")}{" "}{phoneData.newPhone}</p>
                </div>
              </div>

              <div>
                <Label className='text-sm font-medium text-card-foreground block mb-2'>{pbnT("m1037")}</Label>
                <Input type='password' value={phoneData.password} onChange={e => onPhoneDataChange({
            ...phoneData,
            password: e.target.value
          })} placeholder={pbnT("m1076")} disabled={loading} onKeyDown={e => e.key === 'Enter' && !isButtonDisabled() && handleNextStep()} />
                <p className='text-xs text-muted-foreground mt-1'>{pbnT("m1039")}</p>
              </div>
            </>}
        </div>
    </FormDialog>;
}
