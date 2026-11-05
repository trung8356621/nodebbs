/** Field classes for Parent → Child configuration. */
export const FIELD_CLASS = {
  TEMPLATE: 'template',
  MANAGED: 'managed',
  LOCAL: 'local',
};

/**
 * Template-only keys: applied once at Child init. Later Parent sync must not overwrite.
 */
export const TEMPLATE_KEYS = Object.freeze([
  'site_name',
  'site_description',
  'site_logo',
  'site_primary_color',
  'forum_default_locale',
  'categories_seed',
  'admin_bootstrap',
  'free_mode_initial',
  'credit_seed',
  'service_prices_seed',
]);

/**
 * Managed policy keys: Parent may redistribute with a new version; Child stores last applied copy.
 */
export const MANAGED_KEYS = Object.freeze([
  'moderation_config',
  'spam_protection_enabled',
  'spam_protection_block_proxy',
  'spam_protection_block_tor',
  'spam_protection_block_vpn',
  'content_policy_sample',
  'service_catalog_managed',
  'credit_defaults_managed',
  'ui_defaults_managed',
  'seo_technical_managed',
  'locale_catalog_managed',
]);

/**
 * Local settings: Child-owned. Parent sync never writes these.
 */
export const LOCAL_KEYS = Object.freeze([
  'site_url',
  'registration_mode',
  'free_mode',
  'vnd_per_credit',
  'forum_local_services',
  'ops_forum_connections',
  'jwt_secret',
  'cookie_secret',
  'database_url',
  'admin_credentials',
  'users',
  'topics',
  'posts',
  'sys_accounts',
  'sys_transactions',
  'sessions',
]);

export const POLICY_SCHEMA = 'forum-network-policy/1';
export const TOPIC_REF_SCHEMA = 'forum-network-topic-refs/1';
export const NETWORK_ROLES = Object.freeze(['none', 'parent', 'child']);

export const PROTECTED_DATABASES = Object.freeze(['pbn_dev', 'pbn_forum_b']);
export const PROTECTED_FORUM_IDS = Object.freeze(['forum_a', 'forum_b']);
