import { usePbnTranslations } from "@/i18n/useTranslations";
import { Badge } from '@/components/ui/badge';
function getRoleBadgeStyle(role) {
  if (role?.color) {
    return {
      backgroundColor: `${role.color}20`,
      color: role.color,
      borderColor: `${role.color}40`
    };
  }
  return {};
}
export function UserRoleBadges({
  user
}) {
  const pbnT = usePbnTranslations();
  const userRoleList = user.userRoles || [];
  if (userRoleList.length === 0) {
    return <span className="text-xs text-muted-foreground">{pbnT("m862")}</span>;
  }
  return <div className="flex items-center gap-1 flex-wrap">
      {userRoleList.slice(0, 3).map(role => <Badge key={role.id} variant="outline" className="text-xs" style={getRoleBadgeStyle(role)}>
          {role.name || role.slug}
        </Badge>)}
      {userRoleList.length > 3 && <Badge variant="secondary" className="text-xs">
          +{userRoleList.length - 3}
        </Badge>}
      {user.isFounder && <Badge variant="outline" className="text-xs">{pbnT("m892")}</Badge>}
    </div>;
}
