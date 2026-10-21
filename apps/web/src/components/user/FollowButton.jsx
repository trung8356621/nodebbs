'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
export default function FollowButton({
  username,
  initialIsFollowing,
  isFollowing: isFollowingProp,
  onFollowChange,
  className
}) {
  const pbnT = usePbnTranslations();
  const {
    user,
    isAuthenticated,
    openLoginDialog
  } = useAuth();
  const externalValue = initialIsFollowing ?? isFollowingProp ?? false;
  const [isFollowing, setIsFollowing] = useState(externalValue);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setIsFollowing(externalValue);
  }, [externalValue]);
  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      openLoginDialog();
      return;
    }
    setLoading(true);
    try {
      if (isFollowing) {
        await userApi.unfollowUser(username);
        setIsFollowing(false);
        toast.success(pbnT("m1527"));
        onFollowChange?.(false);
      } else {
        await userApi.followUser(username);
        setIsFollowing(true);
        toast.success(pbnT("m1528"));
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error("Follow action failed:", error);
      toast.error(error.message || pbnT("m568"));
    } finally {
      setLoading(false);
    }
  };

  // 不显示关注自己的按钮
  if (user && user.username === username) {
    return null;
  }
  if (!isAuthenticated) {
    return null;
  }
  return <Button onClick={handleToggleFollow} disabled={loading} variant={isFollowing ? 'outline' : 'default'} className={className}>
      {loading ? <>
          <Loader2 className='h-4 w-4 animate-spin' />{pbnT("m1025")}</> : isFollowing ? <>
          <UserMinus className='h-4 w-4' />{pbnT("m1530")}</> : <>
          <UserPlus className='h-4 w-4' />{pbnT("m131")}</>}
    </Button>;
}
