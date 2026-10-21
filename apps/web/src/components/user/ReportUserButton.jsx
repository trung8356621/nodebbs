'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import ReportDialog from '@/components/common/ReportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
export default function ReportUserButton({
  userId,
  username,
  variant = 'outline',
  size,
  className
}) {
  const pbnT = usePbnTranslations();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const {
    isAuthenticated,
    user,
    openLoginDialog
  } = useAuth();
  const handleClick = () => {
    if (!isAuthenticated) {
      openLoginDialog();
      return;
    }

    // 不能举报自己
    if (user && user.id === userId) {
      toast.error(pbnT("m1531"));
      return;
    }
    setReportDialogOpen(true);
  };

  // 如果是自己，不显示按钮（不能举报自己）
  if (user && user.id === userId) {
    return null;
  }
  return <>
      <Button variant={variant} size={size} className={className} onClick={handleClick}>
        <Flag className='h-4 w-4' />{pbnT("m1532")}</Button>

      <ReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} reportType='user' targetId={userId} targetTitle={username} />
    </>;
}
