-- Independent bank-transfer Credit top-up (SePay-first).
-- Reuses sys_accounts / sys_transactions — no second wallet.
-- Applied via drizzle push/migrate or manual apply; kept for audit baseline.

CREATE TABLE IF NOT EXISTS "pbn_topup_packages" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "code" varchar(64) NOT NULL,
  "label" varchar(120) NOT NULL,
  "amount_vnd" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "metadata_json" text,
  CONSTRAINT "pbn_topup_packages_vnd_pos" CHECK ("amount_vnd" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_topup_packages_code_uidx" ON "pbn_topup_packages" ("code");
CREATE INDEX IF NOT EXISTS "pbn_topup_packages_order_idx" ON "pbn_topup_packages" ("display_order");

CREATE TABLE IF NOT EXISTS "pbn_payment_orders" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "order_id" varchar(64) NOT NULL,
  "payment_code" varchar(32) NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "package_code" varchar(64),
  "amount_vnd_requested" integer NOT NULL,
  "amount_vnd_received" integer,
  "credits_to_grant" numeric(30, 10),
  "credits_granted" numeric(30, 10),
  "vnd_per_credit_applied" integer,
  "provider" varchar(32) NOT NULL,
  "provider_txn_ref" varchar(128),
  "bank_txn_ref" varchar(128),
  "receive_account_number" varchar(64),
  "receive_bank_code" varchar(64),
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "ledger_transaction_id" integer,
  "qr_payload_json" text,
  "match_result" varchar(64),
  "last_error" text,
  "confirmed_at" timestamptz,
  "granted_at" timestamptz,
  "expires_at" timestamptz,
  "metadata_json" text,
  "sandbox" boolean DEFAULT true NOT NULL,
  CONSTRAINT "pbn_payment_orders_vnd_req_pos" CHECK ("amount_vnd_requested" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_payment_orders_order_uidx" ON "pbn_payment_orders" ("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_payment_orders_code_uidx" ON "pbn_payment_orders" ("payment_code");
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_payment_orders_idem_uidx" ON "pbn_payment_orders" ("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_payment_orders_provider_txn_uidx"
  ON "pbn_payment_orders" ("provider", "provider_txn_ref");
CREATE INDEX IF NOT EXISTS "pbn_payment_orders_user_idx" ON "pbn_payment_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "pbn_payment_orders_status_idx" ON "pbn_payment_orders" ("status");

CREATE TABLE IF NOT EXISTS "pbn_payment_events" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "provider" varchar(32) NOT NULL,
  "provider_event_id" varchar(128) NOT NULL,
  "provider_txn_ref" varchar(128),
  "bank_txn_ref" varchar(128),
  "order_id" varchar(64),
  "payment_code" varchar(32),
  "transfer_type" varchar(16),
  "amount_vnd" integer,
  "account_number" varchar(64),
  "status" varchar(32) DEFAULT 'received' NOT NULL,
  "match_result" varchar(64),
  "signature_valid" boolean,
  "raw_payload_json" text NOT NULL,
  "headers_json" text,
  "processed_at" timestamptz,
  "error_message" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "pbn_payment_events_provider_event_uidx"
  ON "pbn_payment_events" ("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "pbn_payment_events_order_idx" ON "pbn_payment_events" ("order_id");
CREATE INDEX IF NOT EXISTS "pbn_payment_events_code_idx" ON "pbn_payment_events" ("payment_code");
CREATE INDEX IF NOT EXISTS "pbn_payment_events_status_idx" ON "pbn_payment_events" ("status");

-- Seed default packages (idempotent).
INSERT INTO "pbn_topup_packages" ("code", "label", "amount_vnd", "enabled", "display_order")
VALUES
  ('topup_50k', '50.000 VND', 50000, true, 10),
  ('topup_100k', '100.000 VND', 100000, true, 20),
  ('topup_200k', '200.000 VND', 200000, true, 30),
  ('topup_500k', '500.000 VND', 500000, true, 40)
ON CONFLICT ("code") DO NOTHING;
