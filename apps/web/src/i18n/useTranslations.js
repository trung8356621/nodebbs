import { useLocale } from 'next-intl';
import { translatorFor } from './translate';

export function usePbnTranslations() {
  return translatorFor(useLocale());
}
