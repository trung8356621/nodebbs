import { createTranslator } from 'next-intl';
import english from './messages/en-US.json';
import vietnamese from './messages/vi-VN.json';
import namespaces from './namespaces.json';
import { defaultLocale, localeCookie, validLocale } from './config';

export function messagesFor(locale) {
  if (locale !== 'vi-VN') return english;
  return Object.fromEntries(Object.entries(english).map(([namespace, messages]) => [
    namespace, { ...messages, ...vietnamese[namespace] },
  ]));
}

export function translatorFor(locale) {
  const translate = createTranslator({ locale, messages: messagesFor(locale) });
  const t = (key, values) => translate(`${namespaces[key] || 'common'}.${key}`, values);
  t.locale = locale;
  return t;
}

// Pure utilities accept a translator argument for SSR. Browser callbacks resolve
// the persisted locale at invocation time; no mutable process-wide locale exists.
export function runtimeTranslate(key, values) {
  const cookie = typeof document === 'undefined' ? null : document.cookie.split('; ')
    .find((entry) => entry.startsWith(`${localeCookie}=`))?.split('=')[1];
  return translatorFor(validLocale(cookie) ? cookie : defaultLocale)(key, values);
}
