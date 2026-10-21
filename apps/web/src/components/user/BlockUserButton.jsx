'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/common/FormDialog';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import { blockedUsersApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
export default function BlockUserButton({
  userId,
  username,
  variant = 'outline',
  size,
  className
}) {
  const pbnT = usePbnTranslations();
  const {
    isAuthenticated,
    user
  } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  useEffect(() => {
    if (isAuthenticated && user) {
      checkBlockStatus();
    } else {
      setChecking(false);
    }
  }, [isAuthenticated, user, userId]);
  const checkBlockStatus = async () => {
    try {
      const result = await blockedUsersApi.check(userId);
      setIsBlocked(result.blockedByMe || false);
    } catch (err) {
      console.error("Could not check block status:", err);
    } finally {
      setChecking(false);
    }
  };
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
      console.error("Could not block:", err);
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
      console.error("Could not unblock:", err);
      toast.error(err.message || pbnT("m924"));
    } finally {
      setLoading(false);
    }
  };
  if (user && user.id === userId) return null;
  if (!isAuthenticated) return null;
  if (checking) {
    return <Button variant={variant} className={className} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />{pbnT("m1519")}</Button>;
  }
  return <>
      {isBlocked ? <Button variant={variant} size={size} className={className} onClick={() => setShowUnblockDialog(true)}>
          <ShieldOff className="h-4 w-4" />{pbnT("m1520")}</Button> : <Button variant={variant} size={size} className={className} onClick={() => setShowBlockDialog(true)}>
          <Shield className="h-4 w-4" />{pbnT("m925")}</Button>}

      <FormDialog open={showBlockDialog} onOpenChange={setShowBlockDialog} title={pbnT("m1521")} description={pbnT("m1522", {
      arg0: username
    })} submitText={pbnT("m1523")} submitClassName="bg-destructive hover:bg-destructive/90" onSubmit={handleBlock} loading={loading} />

      <FormDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog} title={pbnT("m1524")} description={pbnT("m1525", {
      arg0: username
    })} submitText={pbnT("m1526")} onSubmit={handleUnblock} loading={loading} />
    </>;
}
