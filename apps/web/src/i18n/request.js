import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, localeCookie, validLocale } from './config';
import { messagesFor } from './translate';

export default getRequestConfig(async () => {
  const preference = (await cookies()).get(localeCookie)?.value;
  const configured = process.env.FORUM_DEFAULT_LOCALE;
  const locale = validLocale(preference) ? preference
    : validLocale(configured) ? configured : defaultLocale;
  return { locale, messages: messagesFor(locale), timeZone: 'Asia/Bangkok' };
});
