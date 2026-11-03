-- Additive forum-pricing/1 verified snapshot store (OPS-SERVER contract).
-- DO NOT auto-apply to production. Operator applies per forum DB after review.
-- Does not modify historical seo_purchases / ops_price_snapshots / wallets.

CREATE TABLE IF NOT EXISTS "ops_forum_pricing_snapshots" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "version" integer NOT NULL,
  "pricing_version_id" varchar(64) NOT NULL,
  "product_key" varchar(32) DEFAULT 'pbn' NOT NULL,
  "schema_version" varchar(32) DEFAULT 'forum-pricing/1' NOT NULL,
  "issued_at" timestamptz NOT NULL,
  "effective_at" timestamptz NOT NULL,
  "valid_until" timestamptz,
  "vnd_per_credit" integer NOT NULL,
  "key_id" varchar(64) NOT NULL,
  "public_key" text NOT NULL,
  "checksum" varchar(64) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "verified_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_pricing_snapshots_version_uidx"
  ON "ops_forum_pricing_snapshots" ("version");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_pricing_snapshots_version_id_uidx"
  ON "ops_forum_pricing_snapshots" ("pricing_version_id");
CREATE INDEX IF NOT EXISTS "ops_forum_pricing_snapshots_effective_idx"
  ON "ops_forum_pricing_snapshots" ("effective_at");

CREATE TABLE IF NOT EXISTS "ops_forum_pricing_syncs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "success" boolean NOT NULL,
  "after_version" integer,
  "current_version" integer,
  "imported_count" integer DEFAULT 0 NOT NULL,
  "reason" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "ops_forum_pricing_syncs_created_idx"
  ON "ops_forum_pricing_syncs" ("created_at");

-- Allow SEO purchases to reference forum-pricing/1 versions without inventing
-- rows in legacy ops_price_snapshots. Historical rows keep stored snapshot_version.
ALTER TABLE "seo_purchases"
  DROP CONSTRAINT IF EXISTS "seo_purchases_snapshot_version_ops_price_snapshots_version_fk";

ALTER TABLE "seo_purchases"
  ADD COLUMN IF NOT EXISTS "pricing_authority" text,
  ADD COLUMN IF NOT EXISTS "ops_pricing_version_id" varchar(64);
