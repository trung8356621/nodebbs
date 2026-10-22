import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import sourceMessages from '@/i18n/source-messages.json';
import { Bell, MessageCircle, UserPlus, Medal, Gift, Coins, CheckCheck, ThumbsUp, Trophy } from 'lucide-react';
export const getNotificationIcon = type => {
  switch (type) {
    case 'reply':
    case 'topic_reply':
      return <MessageCircle className='h-4 w-4 text-blue-500' />;
    case 'mention':
      return <MessageCircle className='h-4 w-4 text-purple-500' />;
    case 'like':
      return <ThumbsUp className='h-4 w-4 text-red-500' />;
    case 'follow':
      return <UserPlus className='h-4 w-4 text-green-500' />;
    case 'message':
      return <MessageCircle className='h-4 w-4 text-blue-500' />;
    case 'badge_earned':
      return <Medal className='h-4 w-4 text-yellow-500' />;
    case 'gift_received':
      return <Gift className='h-4 w-4 text-pink-500' />;
    case 'reward':
    case 'reward_topic':
    case 'reward_reply':
      return <Coins className='h-4 w-4 text-yellow-500' />;
    case 'lottery_won':
      return <Trophy className='h-4 w-4 text-amber-500' />;
    case 'lottery_lost':
      return <Gift className='h-4 w-4 text-muted-foreground' />;
    case 'lottery_drawn':
      return <Trophy className='h-4 w-4 text-amber-600' />;
    case 'report_resolved':
      return <CheckCheck className='h-4 w-4 text-green-600' />;
    case 'report_dismissed':
      return <Bell className='h-4 w-4 text-muted-foreground' />;
    case 'moderation_approved':
      return <CheckCheck className='h-4 w-4 text-green-600' />;
    case 'moderation_rejected':
      return <Bell className='h-4 w-4 text-red-500' />;
    default:
      return <Bell className='h-4 w-4' />;
  }
};
export const getNotificationMessage = (notification, pbnT = pbnRuntimeT) => {
  switch (notification.type) {
    case 'topic_reply':
      return notification.topicTitle ? pbnT("m1433", {
        arg0: notification.topicTitle
      }) : pbnT("m1434");
    case 'reply':
      // reply 类型有两种情况：回复话题 (Reply to Topic) 或 回复人 (Reply to User)
      // 通过检查原始 message 来区分
      // 兼容旧数据 ('帖子') 和新数据 ('回复了你')
      if (notification.message && (notification.message.includes(sourceMessages.m1435) || notification.message.includes(sourceMessages.m1436) || notification.message.includes(pbnT("m1435")) || notification.message.includes(pbnT("m1436")))) {
        return notification.topicTitle ? pbnT("m1437", {
          arg0: notification.topicTitle
        }) : pbnT("m1436");
      }
      return notification.topicTitle ? pbnT("m1438", {
        arg0: notification.topicTitle
      }) : pbnT("m1439");
    case 'like':
      {
        // like 有两种：赞话题正文(postNumber=1) 或 赞回复；后端 metadata.isTopicContent 区分
        let isTopicContent = false;
        try {
          const meta = typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : notification.metadata;
          isTopicContent = !!meta?.isTopicContent;
        } catch {
          // metadata 解析失败按回复处理（兼容无 metadata 的旧数据）
        }
        if (isTopicContent) {
          return notification.topicTitle ? pbnT("m1440", {
            arg0: notification.topicTitle
          }) : pbnT("m1441");
        }
        return notification.topicTitle ? pbnT("m1442", {
          arg0: notification.topicTitle
        }) : pbnT("m1443");
      }
    case 'mention':
      return notification.topicTitle ? pbnT("m1444", {
        arg0: notification.topicTitle
      }) : pbnT("m1445");
    case 'follow':
      return pbnT("m1446");
    case 'message':
      return pbnT("m1447");
    case 'report_resolved':
      return pbnT("m1448");
    case 'report_dismissed':
      return pbnT("m1449");
    case 'badge_earned':
      return pbnT('badgeUnlockTitle');
    case 'gift_received':
      return notification.message;
    case 'reward':
      return pbnT("m1451");
    case 'reward_topic':
      return pbnT("m1452");
    case 'reward_reply':
      return pbnT("m1453");
    case 'lottery_won':
    case 'lottery_lost':
    case 'lottery_drawn':
      return notification.message;
    case 'moderation_approved':
      return notification.message || pbnT("m1454");
    case 'moderation_rejected':
      return notification.message || pbnT("m1455");
    default:
      return notification.message || pbnT("m1456");
  }
};
