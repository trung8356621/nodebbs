import { getLocale } from 'next-intl/server';
import { translatorFor } from './translate';

export async function getPbnTranslations() {
  return translatorFor(await getLocale());
}
