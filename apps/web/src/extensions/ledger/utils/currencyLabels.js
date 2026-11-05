/**
 * Map technical currency codes to stable English display names.
 * UI copy (VI/EN) should prefer i18n keys; DB `name` is only a last resort
 * and must never surface Chinese seed leftovers when code is known.
 */
export const CURRENCY_TECHNICAL_NAMES = {
  credits: 'Credit',
  gold: 'Gold',
};

/** Optional i18n key overrides (namespace: common). */
export const CURRENCY_I18N_KEYS = {
  credits: 'currencyNameCredits',
  gold: 'currencyNameGold',
};

/**
 * @param {{ code?: string, name?: string } | null | undefined} currency
 * @param {(key: string) => string} [t] pbnT / usePbnTranslations
 */
export function currencyDisplayName(currency, t) {
  const code = currency?.code || '';
  const i18nKey = CURRENCY_I18N_KEYS[code];
  if (t && i18nKey) {
    const label = t(i18nKey);
    if (label && label !== i18nKey && label !== `common.${i18nKey}`) return label;
  }
  if (CURRENCY_TECHNICAL_NAMES[code]) return CURRENCY_TECHNICAL_NAMES[code];
  const name = currency?.name;
  // Match legacy Chinese seed leftovers by code point only (no Han string literals).
  if (matchesCodePoints(name, [0x79ef, 0x5206])) return 'Credit';
  if (matchesCodePoints(name, [0x91d1, 0x5e01])) return 'Gold';
  return name || code || 'Credit';
}

function matchesCodePoints(value, points) {
  if (typeof value !== 'string' || value.length !== points.length) return false;
  for (let i = 0; i < points.length; i += 1) {
    if (value.charCodeAt(i) !== points[i]) return false;
  }
  return true;
}
