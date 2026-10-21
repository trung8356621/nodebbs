'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import Link from '@/components/common/Link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

/**
 * 通用 NotFound 组件
 * @param {React.ReactNode} icon - 图标元素
 * @param {string} title - 标题文字
 * @param {string} description - 描述文字
 * @param {boolean} showActions - 是否显示返回按钮组，默认 true
 */
export default function NotFoundView({
  icon,
  title,
  description,
  showActions = true
}) {
  const pbnT = usePbnTranslations();
  return <div className='flex-1 flex items-center justify-center px-4 py-16'>
      <div className='max-w-sm w-full text-center'>
        <div className='flex justify-center mb-6'>
          <div className='rounded-full bg-muted/50 p-5'>
            {icon}
          </div>
        </div>

        <h1 className='text-xl font-semibold text-foreground mb-2'>
          {title}
        </h1>
        <p className='text-sm text-muted-foreground mb-8'>
          {description}
        </p>

        {showActions && <div className='flex items-center justify-center gap-3'>
            <Button variant='outline' size='sm' onClick={() => window.history.back()}>
              <ArrowLeft className='h-4 w-4' />{pbnT("m1432")}</Button>
            <Button size='sm' asChild>
              <Link href='/'>
                <Home className='h-4 w-4' />{pbnT("m1292")}</Link>
            </Button>
          </div>}
      </div>
    </div>;
}
