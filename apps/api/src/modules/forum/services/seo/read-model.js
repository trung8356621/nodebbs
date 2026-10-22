import {sql} from 'drizzle-orm';
import {explicitPermission} from '#core/plugins/rbac/explicitPermission.js';
export const reservedOverride=explicitPermission(sql`topics.user_id`,'seo.reserved_override');
export const seoActive=sql`EXISTS(SELECT 1 FROM seo_entitlements se JOIN posts sp ON sp.topic_id=topics.id AND sp.post_number=1 JOIN users su ON su.id=topics.user_id WHERE se.topic_id=topics.id AND se.user_id=topics.user_id AND se.status='active' AND se.starts_at<=statement_timestamp() AND se.expires_at>statement_timestamp() AND (topics.seo_purchase_allowed OR ${reservedOverride}) AND NOT topics.is_deleted AND topics.approval_status='approved' AND NOT sp.is_deleted AND sp.approval_status='approved' AND NOT su.is_deleted AND NOT su.is_banned)`;
export const seoExpiresAt=sql`(SELECT max(expires_at) FROM seo_entitlements WHERE topic_id=topics.id AND status='active' AND expires_at>statement_timestamp())`;
