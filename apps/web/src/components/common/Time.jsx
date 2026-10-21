'use client';

import { useMemo, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useLocale } from 'next-intl';
import 'dayjs/locale/vi';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

/**
 * Time 组件 - 显示格式化或相对时间（可自动刷新）
 * @param {string|number|Date} date - 日期
 * @param {string} [className] - 自定义 className
 * @param {boolean} [showTooltip=true] - 悬停显示完整时间
 * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - 格式化模板
 * @param {boolean} [fromNow=false] - 是否显示“几分钟前”
 * @param {number} [refreshInterval=60000] - 自动刷新间隔（毫秒），默认 1 分钟
 */
export default function Time({
  date,
  className = '',
  showTooltip = true,
  format = 'YYYY-MM-DD HH:mm:ss',
  fromNow = false,
  refreshInterval = 60000,
}) {
  const locale = useLocale();
  const [tick, setTick] = useState(0);

  // 自动刷新（仅在 fromNow 模式下生效）
  useEffect(() => {
    if (!fromNow) return;
    const timer = setInterval(() => setTick((v) => v + 1), refreshInterval);
    return () => clearInterval(timer);
  }, [fromNow, refreshInterval]);

  const obj = useMemo(() => {
    if (!date) return null;
    const d = dayjs(date).locale(locale === 'vi-VN' ? 'vi' : 'en');
    if (!d.isValid()) return null;

    return {
      title: d.format('YYYY-MM-DD HH:mm:ss'),
      value: fromNow ? d.fromNow() : d.format(format),
    };
  }, [date, format, fromNow, tick, locale]);

  if (!obj) return null;

  return (
    <time
      suppressHydrationWarning={fromNow}
      dateTime={dayjs(date).toISOString()}
      title={showTooltip ? obj.title : undefined}
      className={className}
    >
      {obj.value}
    </time>
  );
}
