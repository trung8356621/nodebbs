'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/common/FormDialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2 } from 'lucide-react';
import { conversationApi, blockedUsersApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
export default function SendMessageButton({
  recipientId,
  recipientName,
  recipientMessagePermission = 'everyone',
  variant = 'outline',
  className = 'w-full'
}) {
  const pbnT = usePbnTranslations();
  const {
    isAuthenticated,
    user,
    openLoginDialog
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);

  // 检查拉黑状态
  useEffect(() => {
    if (isAuthenticated && user && recipientId) {
      checkBlockStatus();
    } else {
      setCheckingBlock(false);
    }
  }, [isAuthenticated, user, recipientId]);
  const checkBlockStatus = async () => {
    try {
      const result = await blockedUsersApi.check(recipientId);
      setIsBlocked(result.isBlocked || false);
    } catch (err) {
      console.error("Could not check block status:", err);
    } finally {
      setCheckingBlock(false);
    }
  };

  // 如果是自己，不显示按钮（不能给自己发消息）
  if (user && user.id === recipientId) {
    return null;
  }

  // 如果接收者禁用了站内信，不显示按钮
  if (recipientMessagePermission === 'disabled') {
    return null;
  }

  // 如果当前用户禁用了站内信，不显示按钮
  if (user && user.messagePermission === 'disabled') {
    return null;
  }

  // 如果存在拉黑关系，不显示按钮
  if (!checkingBlock && isBlocked) {
    return null;
  }
  const handleSend = async () => {
    if (!content.trim()) {
      toast.error(pbnT("m1533"));
      return;
    }
    setSending(true);
    try {
      await conversationApi.send(recipientId, {
        content: content.trim()
      });
      toast.success(pbnT("m1534"));
      setIsOpen(false);
      setContent('');
    } catch (err) {
      console.error("Could not send message:", err);
      toast.error(err.message || pbnT("m974"));
    } finally {
      setSending(false);
    }
  };
  const handleOpenChange = open => {
    if (!isAuthenticated && open) {
      openLoginDialog();
      return;
    }
    setIsOpen(open);
  };
  return <>
      <Button className={className} variant={variant} onClick={() => handleOpenChange(true)}>
        <Mail className='h-4 w-4' />{pbnT("m1535")}</Button>

      <FormDialog open={isOpen} onOpenChange={handleOpenChange} title={pbnT("m1536")} description={pbnT("m1537", {
      arg0: recipientName
    })} submitText={pbnT("m1538")} onSubmit={handleSend} loading={sending} disabled={sending || !content.trim()} maxWidth="sm:max-w-125">
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='content'>{pbnT("m1539")}</Label>
              <Textarea id='content' placeholder={pbnT("m1533")} value={content} onChange={e => setContent(e.target.value)} disabled={sending} className='resize-none min-h-24' autoFocus />
            </div>
          </div>
      </FormDialog>
    </>;
}
