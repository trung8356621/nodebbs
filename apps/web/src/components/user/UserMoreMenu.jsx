'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/common/FormDialog';
import ReportDialog from '@/components/common/ReportDialog';
import { MoreHorizontal, Shield, ShieldOff, Flag } from 'lucide-react';
import { blockedUsersApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 用户主页次要操作菜单 — 拉黑 / 举报
 * 以 ... 图标触发下拉菜单, 相比平铺按钮更节省空间
 */
export default function UserMoreMenu({
  userId,
  username,
  className
}) {
  const pbnT = usePbnTranslations();
  const {
    isAuthenticated,
    user,
    openLoginDialog
  } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await blockedUsersApi.check(userId);
        if (!cancelled) setIsBlocked(result.blockedByMe || false);
      } catch (err) {
        console.error("Could not check block status:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, userId]);
  const handleBlock = async () => {
    setLoading(true);
    try {
      await blockedUsersApi.block(userId);
      setIsBlocked(true);
      toast.success(pbnT("m1516", {
        arg0: username
      }));
      setShowBlockDialog(false);
    } catch (err) {
      toast.error(err.message || pbnT("m1518"));
    } finally {
      setLoading(false);
    }
  };
  const handleUnblock = async () => {
    setLoading(true);
    try {
      await blockedUsersApi.unblock(userId);
      setIsBlocked(false);
      toast.success(pbnT("m922", {
        arg0: username
      }));
      setShowUnblockDialog(false);
    } catch (err) {
      toast.error(err.message || pbnT("m924"));
    } finally {
      setLoading(false);
    }
  };
  const handleReportClick = () => {
    if (!isAuthenticated) {
      openLoginDialog();
      return;
    }
    setReportDialogOpen(true);
  };
  const handleBlockClick = () => {
    if (!isAuthenticated) {
      openLoginDialog();
      return;
    }
    if (isBlocked) {
      setShowUnblockDialog(true);
    } else {
      setShowBlockDialog(true);
    }
  };

  // 自己的主页不显示
  if (user && user.id === userId) return null;
  return <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' aria-label={pbnT("m1545")} className={className}>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuItem onClick={handleBlockClick}>
            {isBlocked ? <>
                <ShieldOff className='h-4 w-4' />{pbnT("m930")}</> : <>
                <Shield className='h-4 w-4' />{pbnT("m925")}</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleReportClick}>
            <Flag className='h-4 w-4' />{pbnT("m1532")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FormDialog open={showBlockDialog} onOpenChange={setShowBlockDialog} title={pbnT("m1521")} description={pbnT("m1522", {
      arg0: username
    })} submitText={pbnT("m1523")} submitClassName='bg-destructive hover:bg-destructive/90' onSubmit={handleBlock} loading={loading} />

      <FormDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog} title={pbnT("m1524")} description={pbnT("m1525", {
      arg0: username
    })} submitText={pbnT("m1526")} onSubmit={handleUnblock} loading={loading} />

      <ReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} reportType='user' targetId={userId} targetTitle={username} />
    </>;
}
