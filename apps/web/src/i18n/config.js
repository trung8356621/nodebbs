export const locales = ['vi-VN', 'en-US'];
export const localeCookie = 'pbn-locale';
export const defaultLocale = locales.includes(process.env.NEXT_PUBLIC_FORUM_DEFAULT_LOCALE)
  ? process.env.NEXT_PUBLIC_FORUM_DEFAULT_LOCALE
  : 'vi-VN';

export function validLocale(value) {
  return locales.includes(value);
}
