'use client';

import { useLocale } from 'next-intl';
import { localeCookie, validLocale } from './config';

export default function LocaleSwitcher() {
  const locale = useLocale();
  function changeLocale(event) {
    const next = event.target.value;
    if (!validLocale(next)) return;
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    // Reload resets locale-dependent client state and keeps the same URL/query.
    window.location.reload();
  }
  return (
    <select
      aria-label={locale === 'vi-VN' ? 'Ngôn ngữ' : 'Language'}
      data-testid="locale-switcher"
      value={locale}
      onChange={changeLocale}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="vi-VN">Tiếng Việt</option>
      <option value="en-US">English</option>
    </select>
  );
}
