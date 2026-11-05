-- Local Forum commercial pricing (Forum-primary). Non-destructive additive baseline.
-- Does not alter forum-pricing/1 signed OPS catalog tables.

CREATE TABLE IF NOT EXISTS forum_local_services (
  service_code varchar(64) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  base_price_vnd integer NOT NULL CHECK (base_price_vnd >= 0),
  local_price_version integer NOT NULL DEFAULT 1 CHECK (local_price_version >= 1),
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS forum_local_service_price_history (
  id uuid PRIMARY KEY,
  service_code varchar(64) NOT NULL REFERENCES forum_local_services(service_code),
  local_price_version integer NOT NULL,
  base_price_vnd integer NOT NULL CHECK (base_price_vnd >= 0),
  enabled boolean NOT NULL,
  options jsonb,
  actor_id integer REFERENCES users(id),
  source varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_code, local_price_version)
);

CREATE INDEX IF NOT EXISTS forum_local_service_price_history_created_idx
  ON forum_local_service_price_history (service_code, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_ops_service_policies (
  service_code varchar(64) PRIMARY KEY,
  banned boolean NOT NULL DEFAULT false,
  override_price_vnd integer CHECK (override_price_vnd IS NULL OR override_price_vnd >= 0),
  ops_version varchar(128),
  ops_pricing_version_id varchar(128),
  evidence jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz
);

CREATE TABLE IF NOT EXISTS forum_commercial_settings (
  key varchar(64) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

INSERT INTO forum_local_services (service_code, enabled, base_price_vnd, local_price_version, options)
VALUES
  ('paid_pin', true, 50000, 1, '{"durationSeconds":86400,"skuCode":"paid_pin_default","name":"Paid topic pin 24h"}'::jsonb),
  ('seo_entitlement', true, 30000, 1, '{"durationMonths":1,"skuCode":"seo_monthly_local","name":"SEO entitlement 1 month"}'::jsonb)
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO forum_local_service_price_history (id, service_code, local_price_version, base_price_vnd, enabled, options, actor_id, source)
SELECT gen_random_uuid(), s.service_code, s.local_price_version, s.base_price_vnd, s.enabled, s.options, NULL, 'system_seed'
FROM forum_local_services s
WHERE NOT EXISTS (
  SELECT 1 FROM forum_local_service_price_history h
  WHERE h.service_code = s.service_code AND h.local_price_version = s.local_price_version
);

INSERT INTO forum_commercial_settings (key, value)
VALUES
  ('free_mode', '{"enabled":false}'::jsonb),
  ('vnd_per_credit', '{"value":10000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Allow Free Mode pin fulfillments (price 0, no debit transaction).
ALTER TABLE pin_entitlements DROP CONSTRAINT IF EXISTS pin_entitlements_valid;
ALTER TABLE pin_entitlements ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE pin_entitlements ADD CONSTRAINT pin_entitlements_valid CHECK (
  ends_at > starts_at
  AND price >= 0
  AND duration_seconds > 0
  AND balance_after >= 0
  AND status IN ('active', 'expired', 'cancelled')
  AND (
    (price = 0 AND transaction_id IS NULL)
    OR (price > 0 AND transaction_id IS NOT NULL)
  )
);
