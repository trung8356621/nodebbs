import fp from 'fastify-plugin';
import { responseLocale, translateResponseMessage } from '../i18n/translate.js';

async function i18nPlugin(fastify) {
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (typeof payload !== 'string' || !String(reply.getHeader('content-type')).includes('application/json')) return payload;
    let data;
    try { data = JSON.parse(payload); } catch { return payload; }
    if (!data || Array.isArray(data) || typeof data !== 'object') return payload;
    const locale = responseLocale(request.headers);
    const pathname = request.url.split('?')[0].replace(/\/$/, '');
    let changed = false;
    // These fields are API response envelopes, not user-generated content.
    for (const field of ['error', 'message']) {
      if (typeof data[field] !== 'string') continue;
      const translated = translateResponseMessage(data[field], locale);
      if (translated !== data[field]) { data[field] = translated; changed = true; }
    }
    if (pathname === '/api/notifications' && Array.isArray(data.items)) {
      const generatedTypes = new Set(['reply', 'topic_reply', 'like', 'mention', 'follow', 'message', 'report_resolved', 'report_dismissed', 'badge_earned', 'gift_received', 'reward', 'reward_topic', 'reward_reply', 'lottery_won', 'lottery_lost', 'lottery_drawn', 'moderation_approved', 'moderation_rejected']);
      for (const item of data.items) {
        if (!generatedTypes.has(item.type)) continue;
        const translated = translateResponseMessage(item.message, locale);
        if (translated !== item.message) { item.message = translated; changed = true; }
      }
    }
    // Static form metadata is application UI, not a user's editable role/name.
    if (pathname === '/api/roles/config') {
      const localizeMetadata = (node) => {
        if (!node || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node)) {
          if (['label', 'description', 'placeholder'].includes(key) && typeof value === 'string') {
            const translated = translateResponseMessage(value, locale);
            if (translated !== value) { node[key] = translated; changed = true; }
          } else if (value && typeof value === 'object') localizeMetadata(value);
        }
      };
      localizeMetadata(data);
    }
    if (pathname.startsWith('/api/moderation/')) {
      const asArray = (value) => Array.isArray(value) ? value : [];
      for (const item of [...asArray(data.availableTypes), ...asArray(data.types), ...asArray(data.items)]) {
        for (const field of ['label', 'typeLabel']) {
          const translated = translateResponseMessage(item[field], locale);
          if (translated !== item[field]) { item[field] = translated; changed = true; }
        }
      }
    }
    if (changed) {
      const vary = String(reply.getHeader('vary') || '').split(',').map((part) => part.trim()).filter(Boolean);
      reply.header('Vary', [...new Set([...vary, 'Cookie', 'Accept-Language'])].join(', '));
      reply.header('Content-Language', locale);
      return JSON.stringify(data);
    }
    return payload;
  });
}

export default fp(i18nPlugin, { name: 'i18n' });
