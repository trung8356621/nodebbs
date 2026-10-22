import {sql} from 'drizzle-orm';
export function explicitPermission(userId,slug) {
  return sql`EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=${userId} AND p.slug=${slug} AND (ur.expires_at IS NULL OR ur.expires_at>statement_timestamp()) AND (rp.conditions IS NULL OR rp.conditions='{}'))`;
}
