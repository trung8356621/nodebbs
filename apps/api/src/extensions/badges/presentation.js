export const seededBadges = {
  "reg-7days": {
    "name": "Early Member",
    "description": "Member for 7 days",
    "legacyName": "初来乍到",
    "theme": "common"
  },
  "reg-30days": {
    "name": "Regular Member",
    "description": "Member for 30 days",
    "legacyName": "满月礼",
    "theme": "strong"
  },
  "reg-1year": {
    "name": "Longtime Member",
    "description": "Member for one year",
    "legacyName": "老朋友",
    "theme": "rare"
  },
  "post-1": {
    "name": "First Reply",
    "description": "Publish your first reply",
    "legacyName": "初试啼声",
    "theme": "common"
  },
  "post-100": {
    "name": "Active Member",
    "description": "Publish 100 replies",
    "legacyName": "活跃分子",
    "theme": "strong"
  },
  "post-1000": {
    "name": "Community Contributor",
    "description": "Publish 1,000 replies",
    "legacyName": "妙语连珠",
    "theme": "rare"
  },
  "topic-1": {
    "name": "First Topic",
    "description": "Publish your first topic",
    "legacyName": "抛砖引玉",
    "theme": "common"
  },
  "topic-50": {
    "name": "Topic Contributor",
    "description": "Publish 50 topics",
    "legacyName": "话题达人",
    "theme": "strong"
  },
  "like-10": {
    "name": "Appreciated Member",
    "description": "Receive 10 likes",
    "legacyName": "小有名气",
    "theme": "common"
  },
  "like-100": {
    "name": "Community Favorite",
    "description": "Receive 100 likes",
    "legacyName": "众星捧月",
    "theme": "rare"
  },
  "like-1000": {
    "name": "Community Star",
    "description": "Receive 1,000 likes",
    "legacyName": "万众瞩目",
    "theme": "premium"
  },
  "streak-7": {
    "name": "Steady Member",
    "description": "Check in for 7 consecutive days",
    "legacyName": "坚持不懈",
    "theme": "common"
  },
  "streak-30": {
    "name": "Dedicated Member",
    "description": "Check in for 30 consecutive days",
    "legacyName": "持之以恒",
    "theme": "strong"
  },
  "streak-100": {
    "name": "Committed Member",
    "description": "Check in for 100 consecutive days",
    "legacyName": "意志如钢",
    "theme": "premium"
  },
  "admin-verified": {
    "name": "Verified Operator",
    "description": "Assigned by a forum operator",
    "legacyName": "管理员认证",
    "theme": "premium"
  }
};

export function presentBadge(badge) {
  const preset = seededBadges[badge.slug];
  const isSeed = preset && [preset.name, preset.legacyName].includes(badge.name);
  let metadata = {};
  try { metadata = typeof badge.metadata === 'string' ? JSON.parse(badge.metadata) : badge.metadata || {}; } catch {}
  const requested = metadata?.frameTheme || metadata?.rarity;
  const aliases = {uncommon:'strong', legendary:'premium', epic:'premium'};
  const candidate = aliases[requested] || requested;
  const theme = ['common','strong','rare','premium'].includes(candidate) ? candidate : isSeed ? preset.theme : 'common';
  return {...badge, ...(isSeed ? {name:preset.name, description:preset.description, translationKey:badge.slug} : {}), frameTheme:theme};
}
export function badgeFrame(userBadge) {
  if (!userBadge) return null;
  const badge = presentBadge(userBadge.badge);
  return {id:userBadge.id, itemType:'badge', itemName:badge.name, itemMetadata:JSON.stringify({theme:badge.frameTheme})};
}
