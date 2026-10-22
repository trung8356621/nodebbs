CREATE TABLE "ops_price_snapshots" (
	"version" integer PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"checksum" text NOT NULL,
	"payload" jsonb NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_price_syncs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"success" boolean NOT NULL,
	"version" integer,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_entitlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purchase_id" uuid NOT NULL,
	"topic_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_entitlements_purchase_id_unique" UNIQUE("purchase_id"),
	CONSTRAINT "seo_entitlement_valid" CHECK ("seo_entitlements"."expires_at">"seo_entitlements"."starts_at" AND "seo_entitlements"."status" IN ('active','expired','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "seo_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purchase_id" uuid,
	"topic_id" integer NOT NULL,
	"type" text NOT NULL,
	"actor_id" integer,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_event_once" UNIQUE("purchase_id","type")
);
--> statement-breakpoint
CREATE TABLE "seo_products" (
	"snapshot_version" integer NOT NULL,
	"product_id" text NOT NULL,
	"price_version" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"duration_months" integer NOT NULL,
	"list_price" bigint NOT NULL,
	"sale_price" bigint NOT NULL,
	"enabled" boolean NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"renewal_window_days" integer NOT NULL,
	"discount" jsonb,
	CONSTRAINT "seo_products_snapshot_version_product_id_price_version_pk" PRIMARY KEY("snapshot_version","product_id","price_version"),
	CONSTRAINT "seo_product_prices" CHECK ("seo_products"."sale_price">=0 AND "seo_products"."list_price">="seo_products"."sale_price" AND "seo_products"."list_price"<=1000000000 AND "seo_products"."duration_months" BETWEEN 1 AND 12 AND "seo_products"."renewal_window_days" BETWEEN 0 AND 14 AND ("seo_products"."ends_at" IS NULL OR "seo_products"."ends_at">"seo_products"."effective_at"))
);
--> statement-breakpoint
CREATE TABLE "seo_purchases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"snapshot_version" integer NOT NULL,
	"price_version" integer NOT NULL,
	"list_price" bigint NOT NULL,
	"paid_price" bigint NOT NULL,
	"duration_months" integer NOT NULL,
	"price_snapshot" jsonb NOT NULL,
	"transaction_id" integer,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_purchases_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "seo_purchases_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "seo_purchase_user_key" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "seo_purchase_accounting" CHECK ("seo_purchases"."paid_price">=0 AND "seo_purchases"."list_price">="seo_purchases"."paid_price" AND "seo_purchases"."balance_before"-"seo_purchases"."paid_price"="seo_purchases"."balance_after" AND "seo_purchases"."balance_after">=0 AND (("seo_purchases"."paid_price"=0 AND "seo_purchases"."transaction_id" IS NULL) OR ("seo_purchases"."paid_price">0 AND "seo_purchases"."transaction_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "seo_quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"product_id" text NOT NULL,
	"price_snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "seo_purchase_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "seo_entitlements" ADD CONSTRAINT "seo_entitlements_purchase_id_seo_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."seo_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_entitlements" ADD CONSTRAINT "seo_entitlements_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_entitlements" ADD CONSTRAINT "seo_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_events" ADD CONSTRAINT "seo_events_purchase_id_seo_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."seo_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_events" ADD CONSTRAINT "seo_events_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_events" ADD CONSTRAINT "seo_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_products" ADD CONSTRAINT "seo_products_snapshot_version_ops_price_snapshots_version_fk" FOREIGN KEY ("snapshot_version") REFERENCES "public"."ops_price_snapshots"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_purchases" ADD CONSTRAINT "seo_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_purchases" ADD CONSTRAINT "seo_purchases_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_purchases" ADD CONSTRAINT "seo_purchases_quote_id_seo_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."seo_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_purchases" ADD CONSTRAINT "seo_purchases_snapshot_version_ops_price_snapshots_version_fk" FOREIGN KEY ("snapshot_version") REFERENCES "public"."ops_price_snapshots"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_purchases" ADD CONSTRAINT "seo_purchases_transaction_id_sys_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."sys_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_quotes" ADD CONSTRAINT "seo_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_quotes" ADD CONSTRAINT "seo_quotes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seo_entitlement_topic_idx" ON "seo_entitlements" USING btree ("topic_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "seo_entitlement_due_idx" ON "seo_entitlements" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "seo_events_topic_idx" ON "seo_events" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "seo_products_interval_idx" ON "seo_products" USING btree ("snapshot_version","product_id","effective_at");--> statement-breakpoint
CREATE INDEX "seo_purchase_topic_idx" ON "seo_purchases" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "seo_quotes_owner_idx" ON "seo_quotes" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE FUNCTION pbn_seo_add_months(instant timestamptz, months integer) RETURNS timestamptz LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT ((instant AT TIME ZONE 'Asia/Ho_Chi_Minh')+make_interval(months=>months)) AT TIME ZONE 'Asia/Ho_Chi_Minh'
$$;
CREATE FUNCTION pbn_seo_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Commercial history is immutable; append a correction'; END $$;
CREATE TRIGGER ops_snapshot_immutable BEFORE UPDATE OR DELETE ON ops_price_snapshots FOR EACH ROW EXECUTE FUNCTION pbn_seo_immutable();
CREATE TRIGGER ops_products_immutable BEFORE UPDATE OR DELETE ON seo_products FOR EACH ROW EXECUTE FUNCTION pbn_seo_immutable();
CREATE TRIGGER seo_purchases_immutable BEFORE UPDATE OR DELETE ON seo_purchases FOR EACH ROW EXECUTE FUNCTION pbn_seo_immutable();
CREATE TRIGGER seo_events_immutable BEFORE UPDATE OR DELETE ON seo_events FOR EACH ROW EXECUTE FUNCTION pbn_seo_immutable();
CREATE TRIGGER seo_quotes_immutable BEFORE UPDATE OR DELETE ON seo_quotes FOR EACH ROW EXECUTE FUNCTION pbn_seo_immutable();
CREATE TRIGGER seo_terms_immutable BEFORE UPDATE OR DELETE ON seo_entitlements FOR EACH ROW EXECUTE FUNCTION pbn_pin_entitlement_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pbn_pin_transaction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.type IN ('pin_purchase','pin_correction','seo_purchase','seo_correction') THEN RAISE EXCEPTION 'Commercial ledger is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE FUNCTION pbn_seo_purchase_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM seo_entitlements e WHERE e.purchase_id=NEW.id AND e.user_id=NEW.user_id AND e.topic_id=NEW.topic_id) THEN RAISE EXCEPTION 'Purchase requires its entitlement'; END IF;
 IF NEW.paid_price>0 AND NOT EXISTS(SELECT 1 FROM sys_transactions t WHERE t.id=NEW.transaction_id AND t.type='seo_purchase' AND t.user_id=NEW.user_id AND t.amount=-NEW.paid_price AND t.balance_after=NEW.balance_after AND t.currency_code='credits') THEN RAISE EXCEPTION 'Purchase requires its exact debit'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER seo_purchase_integrity AFTER INSERT ON seo_purchases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pbn_seo_purchase_integrity();
CREATE FUNCTION pbn_seo_debit_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.type='seo_purchase' AND NOT EXISTS(SELECT 1 FROM seo_purchases p WHERE p.transaction_id=NEW.id) THEN RAISE EXCEPTION 'SEO debit requires its purchase'; END IF; RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER seo_debit_integrity AFTER INSERT ON sys_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pbn_seo_debit_integrity();
