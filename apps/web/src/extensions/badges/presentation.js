const defaults = {"reg-7days": "Early Member", "reg-30days": "Regular Member", "reg-1year": "Longtime Member", "post-1": "First Reply", "post-100": "Active Member", "post-1000": "Community Contributor", "topic-1": "First Topic", "topic-50": "Topic Contributor", "like-10": "Appreciated Member", "like-100": "Community Favorite", "like-1000": "Community Star", "streak-7": "Steady Member", "streak-30": "Dedicated Member", "streak-100": "Committed Member", "admin-verified": "Verified Operator"};
export function localizeBadge(badge,t) {
  if(!badge)return badge;
  const key=badge.translationKey || (defaults[badge.slug]===badge.name?badge.slug:null);
  return key?{...badge,name:t('badge_'+key+'_name'),description:t('badge_'+key+'_description')}:badge;
}
