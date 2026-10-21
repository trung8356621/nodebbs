import source from './messages/source.json' with { type: 'json' };
import english from './messages/en-US.json' with { type: 'json' };
import vietnamese from './messages/vi-VN.json' with { type: 'json' };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(source).map(([key, text]) => ({
  key,
  names: [...text.matchAll(/\{(arg\d+)\}/g)].map((match) => match[1]),
  pattern: new RegExp(`^${text.split(/\{arg\d+\}/).map(escapeRegex).join('([\\s\\S]*?)')}$`, 'u'),
  specificity: text.replace(/\{arg\d+\}/g, '').length,
})).sort((a, b) => b.specificity - a.specificity);

export function responseLocale(headers) {
  const cookie = headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('pbn-locale='))?.slice('pbn-locale='.length);
  if (cookie === 'vi-VN' || cookie === 'en-US') return cookie;
  const language = headers['accept-language']?.split(',')[0]?.trim();
  if (language === 'vi-VN' || language === 'en-US') return language;
  return process.env.FORUM_DEFAULT_LOCALE === 'en-US' ? 'en-US' : 'vi-VN';
}

// Only application-owned response messages use this catalog. Never walk or
// translate arbitrary response data, post bodies, titles, names or settings.
export function translateResponseMessage(value, locale) {
  if (typeof value !== 'string') return value;
  for (const { key, names, pattern } of patterns) {
    const match = pattern.exec(value);
    if (!match) continue;
    const values = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
    const template = (locale === 'vi-VN' ? vietnamese[key] : undefined) || english[key];
    return template.replace(/\{(arg\d+)\}/g, (_, name) => values[name] ?? '');
  }
  return value;
}
