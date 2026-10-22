import {usePbnTranslations} from '@/i18n/useTranslations';
import {Avatar,AvatarImage,AvatarFallback} from '@/components/ui/avatar';
import {User} from 'lucide-react';
import {cn} from '@/lib/utils';
import {getImageUrl} from '@/utils/image';
import {generateAvatarColor} from '@/utils/color';
const sizes={xs:'h-6 w-6 text-xs',sm:'h-8 w-8 text-sm',md:'h-10 w-10 text-base',lg:'h-12 w-12 text-lg',xl:'h-16 w-16 text-xl'};
const frames={
  default:{background:'#cbd5e1'},
  common:{background:'#22c55e'},
  strong:{background:'#2563eb',padding:3},
  rare:{background:'linear-gradient(135deg,#06b6d4,#8b5cf6)'},
  premium:{background:'linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)',boxShadow:'0 0 8px #a855f755'},
};
export default function UserAvatar({url,name,size='md',className='',frameMetadata=null,modifiers='embed,f_webp,s_200x200'}) {
  const t=usePbnTranslations();let metadata={};
  try{metadata=typeof frameMetadata==='string'?JSON.parse(frameMetadata):frameMetadata||{};}catch{}
  const theme=Object.hasOwn(frames,metadata?.theme)?metadata.theme:'default';
  const avatarUrl=getImageUrl(url,modifiers),color=!avatarUrl?generateAvatarColor(name):null;
  return <span data-frame-theme={theme} className={cn('inline-flex shrink-0 rounded-full',sizes[size]||sizes.md,className)} style={{padding:2,...frames[theme]}}>
    <Avatar className="w-full h-full border border-background">
      {avatarUrl&&<AvatarImage src={avatarUrl} alt={name||t('m1541')} className="object-cover"/>}
      <AvatarFallback className={color?'text-white':'bg-muted text-muted-foreground'} style={color?{background:color}:undefined}>{name?name.charAt(0).toUpperCase():<User className="h-1/2 w-1/2"/>}</AvatarFallback>
    </Avatar>
  </span>;
}
