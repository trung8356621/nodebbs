import {
  resolvePublicSiteOrigin,
  buildTopicCanonicalUrl,
} from '../crypto.js';

/**
 * Resolve canonical topic URL from validated public site origin.
 * Preference: site_url setting → FORUM_WEB_ORIGIN → FORUM_PUBLIC_ORIGIN.
 */
export async function resolveTopicCanonicalUrl(fastify, topicId) {
  const siteUrl = await fastify.settings.get('site_url', '');
  const raw =
    (siteUrl && String(siteUrl).trim()) ||
    process.env.FORUM_WEB_ORIGIN ||
    process.env.FORUM_PUBLIC_ORIGIN ||
    '';
  const origin = resolvePublicSiteOrigin(raw);
  return buildTopicCanonicalUrl(origin, topicId);
}
