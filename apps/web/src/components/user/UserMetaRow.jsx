import { usePbnTranslations } from "@/i18n/useTranslations";
import { MapPin, Calendar } from 'lucide-react';
import Time from '@/components/common/Time';
import { cn } from '@/lib/utils';

/**
 * 用户元信息行 — 位置 + 加入时间 (可选), 支持 children 附加内联项
 *
 * 典型使用:
 *   <UserMetaRow user={user} className='text-sm text-muted-foreground'>
 *     <Link>...关注者</Link>
 *     <Link>...关注</Link>
 *   </UserMetaRow>
 *
 * @param {Object} props
 * @param {Object} props.user - 用户信息 (读取 location, createdAt)
 * @param {{location?: boolean, joined?: boolean}} props.show - 控制显示字段, 默认全显
 * @param {string} props.iconClassName - 图标 className, 默认 h-3.5
 * @param {string} props.joinedFormat - Time 格式化字符串
 * @param {string} props.joinedSuffix - 加入时间后缀文本
 * @param {string} props.className - 容器样式
 * @param {React.ReactNode} props.children - 附加内联项 (如 followers/following 链接)
 */
export default function UserMetaRow(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    user,
    show = {
      location: true,
      joined: true
    },
    iconClassName = 'h-3.5 w-3.5 shrink-0',
    joinedFormat = pbnT("m1543"),
    joinedSuffix = pbnT("m1544"),
    className,
    children
  } = pbnArgument0;
  if (!user) return null;
  const showLocation = show.location !== false && user.location;
  const showJoined = show.joined !== false && user.createdAt;
  if (!showLocation && !showJoined && !children) return null;
  return <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {showLocation && <span className='flex items-center gap-1'>
          <MapPin className={iconClassName} />
          <span className='break-words'>{user.location}</span>
        </span>}
      {showJoined && <span className='flex items-center gap-1'>
          <Calendar className={iconClassName} />
          <Time date={user.createdAt} format={joinedFormat} /> {joinedSuffix}
        </span>}
      {children}
    </div>;
}
