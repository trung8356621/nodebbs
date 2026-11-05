-- Forum Network (Parent/Child) addon tables.
-- Additive, IF NOT EXISTS. Safe for greenfield Child/Parent fixtures.
-- Does not require OPS-SERVER or Installation Key.
-- Parent/Child roles are settings-driven (any forum may enable Parent).

CREATE TABLE IF NOT EXISTS forum_network_settings (
  key varchar(64) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS forum_network_children (
  child_forum_id varchar(64) PRIMARY KEY,
  display_name varchar(255) NOT NULL,
  database_name varchar(128) NOT NULL,
  api_origin varchar(500),
  web_origin varchar(500),
  status varchar(32) NOT NULL DEFAULT 'active',
  template_id varchar(64),
  free_mode_expires_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_network_children_status_chk CHECK (status IN ('active', 'disabled', 'provisioning', 'failed'))
);

CREATE INDEX IF NOT EXISTS forum_network_children_status_idx
  ON forum_network_children (status, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_network_templates (
  id varchar(64) PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS forum_network_policy_versions (
  version varchar(128) PRIMARY KEY,
  checksum varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by integer REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_network_policy_versions_checksum_uidx
  ON forum_network_policy_versions (checksum);

CREATE TABLE IF NOT EXISTS forum_network_policy_applications (
  id uuid PRIMARY KEY,
  policy_version varchar(128) NOT NULL,
  checksum varchar(64) NOT NULL,
  source varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  applied_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  skipped_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  actor_id integer REFERENCES users(id),
  CONSTRAINT forum_network_policy_applications_status_chk
    CHECK (status IN ('applied', 'skipped_duplicate', 'failed', 'partial'))
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_network_policy_applications_version_uidx
  ON forum_network_policy_applications (policy_version)
  WHERE status IN ('applied', 'skipped_duplicate');

CREATE INDEX IF NOT EXISTS forum_network_policy_applications_applied_idx
  ON forum_network_policy_applications (applied_at DESC);

-- Reference-only topic fingerprints for Child init duplicate checks.
-- Never exposed as user-authored topics/posts on the Child.
CREATE TABLE IF NOT EXISTS forum_topic_reference_snapshots (
  id uuid PRIMARY KEY,
  source_forum_id varchar(64) NOT NULL,
  source_topic_key varchar(128),
  title_normalized text NOT NULL,
  title_hash varchar(64) NOT NULL,
  category_hint varchar(128),
  package_version varchar(128),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_topic_reference_snapshots_hash_idx
  ON forum_topic_reference_snapshots (title_hash);

CREATE INDEX IF NOT EXISTS forum_topic_reference_snapshots_source_idx
  ON forum_topic_reference_snapshots (source_forum_id, captured_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS forum_topic_reference_snapshots_dedupe_uidx
  ON forum_topic_reference_snapshots (source_forum_id, title_hash);

-- Optional OPS multi-forum adapter placeholder (no OPS dependency).
INSERT INTO forum_network_settings (key, value)
VALUES
  ('role', '{"role":"none"}'::jsonb),
  ('ops_adapter', '{"status":"unsupported","contract":null,"note":"Optional future multi-forum OPS adapter; not required for Parent/Child."}'::jsonb)
ON CONFLICT (key) DO NOTHING;
