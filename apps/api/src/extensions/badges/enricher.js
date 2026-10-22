import {userEnricher} from '../../services/user/index.js';
import {getUserBadges,getUsersBadges} from './services/badgeService.js';
import {badgeFrame} from './presentation.js';
function apply(user,owned) {
  user.badges = owned.filter(b=>b.isDisplayed!==false).slice(0,1);
  user.avatarFrame = badgeFrame(user.badges[0]);
}
export default function registerBadgeEnricher() {
  userEnricher.register('badges',async user=>{
    if(user?.id) apply(user,await getUserBadges(user.id));
  });
  userEnricher.registerBatch('badges',async users=>{
    const ids=[...new Set(users.filter(u=>u?.id).map(u=>u.id))];
    const owned=await getUsersBadges(ids);
    users.forEach(user=>apply(user,owned[user.id]||[]));
  });
}
