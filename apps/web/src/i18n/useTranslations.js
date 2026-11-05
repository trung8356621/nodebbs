import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { translatorFor } from './translate';

/** Stable translator per locale — avoids fetch/effect loops that depend on `t`. */
export function usePbnTranslations() {
  const locale = useLocale();
  return useMemo(() => translatorFor(locale), [locale]);
}
