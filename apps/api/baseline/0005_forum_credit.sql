-- Forum Credit OPS integration (forum-credit/1)
-- Applied via drizzle-kit push/migrate; kept here for audit baseline.

CREATE TABLE IF NOT EXISTS "ops_forum_connections" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "ops_base_url" varchar(500) NOT NULL,
  "installation_id" varchar(64) NOT NULL,
  "forum_id" varchar(64) NOT NULL,
  "api_contract_version" varchar(32) DEFAULT 'forum-credit/1' NOT NULL,
  "credential_version" integer DEFAULT 1 NOT NULL,
  "credential_ciphertext" text NOT NULL,
  "credential_kek_version" varchar(32) DEFAULT 'v1' NOT NULL,
  "credential_fingerprint" varchar(64) NOT NULL,
  "connection_status" varchar(32) DEFAULT 'disconnected' NOT NULL,
  "connection_url" varchar(500),
  "pending_rotation_id" varchar(64),
  "pending_credential_ciphertext" text,
  "pending_credential_fingerprint" varchar(64),
  "pending_credential_version" integer,
  "last_verified_at" timestamptz,
  "last_sync_at" timestamptz,
  "last_error" text,
  "enabled" boolean DEFAULT true NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_connections_installation_uidx" ON "ops_forum_connections" ("installation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_connections_forum_uidx" ON "ops_forum_connections" ("forum_id");

CREATE TABLE IF NOT EXISTS "ops_forum_credit_deliveries" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "event_id" varchar(64) NOT NULL,
  "order_id" varchar(64),
  "order_reference" varchar(128),
  "forum_id" varchar(64) NOT NULL,
  "installation_id" varchar(64) NOT NULL,
  "local_user_id" varchar(64) NOT NULL,
  "order_kind" varchar(32),
  "amount_vnd" integer DEFAULT 0 NOT NULL,
  "credits_granted" integer DEFAULT 0 NOT NULL,
  "is_free_launch" boolean DEFAULT false NOT NULL,
  "transaction_id" integer,
  "payload_json" text NOT NULL,
  "applied_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_credit_deliveries_event_uidx" ON "ops_forum_credit_deliveries" ("event_id");
CREATE INDEX IF NOT EXISTS "ops_forum_credit_deliveries_order_idx" ON "ops_forum_credit_deliveries" ("order_id");
CREATE INDEX IF NOT EXISTS "ops_forum_credit_deliveries_user_idx" ON "ops_forum_credit_deliveries" ("local_user_id");

CREATE TABLE IF NOT EXISTS "ops_forum_credit_orders" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "installation_id" varchar(64) NOT NULL,
  "forum_id" varchar(64) NOT NULL,
  "ops_order_id" varchar(64),
  "local_user_id" varchar(64) NOT NULL,
  "order_reference" varchar(128) NOT NULL,
  "amount_vnd" integer DEFAULT 0 NOT NULL,
  "credits_to_grant" integer DEFAULT 0 NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "order_kind" varchar(32) DEFAULT 'free_grant' NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "last_error" text,
  "metadata_json" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_credit_orders_ref_uidx" ON "ops_forum_credit_orders" ("installation_id", "order_reference");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_credit_orders_idem_uidx" ON "ops_forum_credit_orders" ("installation_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "ops_forum_credit_orders_user_idx" ON "ops_forum_credit_orders" ("local_user_id");

CREATE TABLE IF NOT EXISTS "ops_forum_ledger_outbox" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "event_id" varchar(64) NOT NULL,
  "transaction_id" varchar(64) NOT NULL,
  "local_user_id" varchar(64) NOT NULL,
  "transaction_type" varchar(64) NOT NULL,
  "credit_delta" bigint NOT NULL,
  "sequence_number" integer NOT NULL,
  "event_timestamp" timestamptz NOT NULL,
  "related_order_reference" varchar(128),
  "correlation_id" varchar(64),
  "sync_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamptz DEFAULT now() NOT NULL,
  "last_error" text,
  "synced_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_ledger_outbox_event_uidx" ON "ops_forum_ledger_outbox" ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_ledger_outbox_tx_uidx" ON "ops_forum_ledger_outbox" ("transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_forum_ledger_outbox_seq_uidx" ON "ops_forum_ledger_outbox" ("sequence_number");
CREATE INDEX IF NOT EXISTS "ops_forum_ledger_outbox_status_idx" ON "ops_forum_ledger_outbox" ("sync_status", "next_attempt_at");
