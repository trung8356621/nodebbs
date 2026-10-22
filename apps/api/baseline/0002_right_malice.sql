CREATE TABLE "pin_entitlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"price" bigint NOT NULL,
	"duration_seconds" integer NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pin_entitlements_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "pin_entitlements_user_key" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "pin_entitlements_valid" CHECK ("pin_entitlements"."ends_at">"pin_entitlements"."starts_at" AND "pin_entitlements"."price">0 AND "pin_entitlements"."duration_seconds">0 AND "pin_entitlements"."balance_after">=0 AND "pin_entitlements"."status" IN ('active','expired','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "pin_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entitlement_id" uuid,
	"topic_id" integer NOT NULL,
	"type" text NOT NULL,
	"actor_id" integer,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pin_events_once" UNIQUE("entitlement_id","type")
);
--> statement-breakpoint
CREATE TABLE "topic_link_classifications" (
	"topic_id" integer PRIMARY KEY NOT NULL,
	"editorial" boolean DEFAULT false NOT NULL,
	"advertising" boolean DEFAULT false NOT NULL,
	"reviewer_id" integer NOT NULL,
	"reason" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pin_entitlements" ADD CONSTRAINT "pin_entitlements_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_entitlements" ADD CONSTRAINT "pin_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_entitlements" ADD CONSTRAINT "pin_entitlements_product_id_shop_items_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_entitlements" ADD CONSTRAINT "pin_entitlements_transaction_id_sys_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."sys_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_events" ADD CONSTRAINT "pin_events_entitlement_id_pin_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."pin_entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_events" ADD CONSTRAINT "pin_events_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pin_events" ADD CONSTRAINT "pin_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_link_classifications" ADD CONSTRAINT "topic_link_classifications_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_link_classifications" ADD CONSTRAINT "topic_link_classifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pin_entitlements_topic_idx" ON "pin_entitlements" USING btree ("topic_id","status","ends_at");--> statement-breakpoint
CREATE INDEX "pin_entitlements_expiry_idx" ON "pin_entitlements" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "pin_events_topic_idx" ON "pin_events" USING btree ("topic_id","created_at");--> statement-breakpoint
ALTER TABLE "sys_accounts" ADD CONSTRAINT "sys_accounts_balance_safe" CHECK ("sys_accounts"."balance" >= 0 AND "sys_accounts"."balance" <= 9007199254740991);
--> statement-breakpoint
CREATE FUNCTION pbn_pin_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Paid pin history is immutable; use a compensating correction';
END $$;
CREATE TRIGGER pin_events_immutable BEFORE UPDATE OR DELETE ON pin_events FOR EACH ROW EXECUTE FUNCTION pbn_pin_immutable();
--> statement-breakpoint
CREATE FUNCTION pbn_pin_entitlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Paid pin history cannot be deleted'; END IF;
  IF (to_jsonb(NEW)-'status'-'reason') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'reason') THEN
    RAISE EXCEPTION 'Paid pin purchase terms are immutable';
  END IF;
  IF OLD.status <> 'active' AND NEW.status='active' THEN RAISE EXCEPTION 'A closed entitlement cannot be reactivated'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pin_entitlements_immutable BEFORE UPDATE OR DELETE ON pin_entitlements FOR EACH ROW EXECUTE FUNCTION pbn_pin_entitlement_guard();
--> statement-breakpoint
CREATE FUNCTION pbn_pin_transaction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.type IN ('pin_purchase','pin_correction') THEN RAISE EXCEPTION 'Paid pin ledger is immutable'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER pin_transactions_immutable BEFORE UPDATE OR DELETE ON sys_transactions FOR EACH ROW EXECUTE FUNCTION pbn_pin_transaction_guard();
--> statement-breakpoint
CREATE FUNCTION pbn_pin_editorial_reset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='topics' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN UPDATE topic_link_classifications SET editorial=false,updated_at=clock_timestamp() WHERE topic_id=NEW.id; END IF;
  ELSE
    IF NEW.post_number=1 AND NEW.content IS DISTINCT FROM OLD.content THEN UPDATE topic_link_classifications SET editorial=false,updated_at=clock_timestamp() WHERE topic_id=NEW.topic_id; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pin_editorial_title_reset AFTER UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION pbn_pin_editorial_reset();
CREATE TRIGGER pin_editorial_body_reset AFTER UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION pbn_pin_editorial_reset();
--> statement-breakpoint
INSERT INTO permissions(slug,name,module,action,is_system) VALUES('editorial.classify','Independent editorial review','editorial','classify',true) ON CONFLICT(slug) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.slug='admin' AND p.slug='editorial.classify' ON CONFLICT DO NOTHING;
INSERT INTO shop_items(type,consume_type,name,description,price,currency_code,metadata,display_order) VALUES
('topic_pin','consumable','1 day / 1 ngày','Paid placement; no refund / Ghim trả phí; không hoàn tiền',10,'gold','{"durationSeconds":86400}',1),
('topic_pin','consumable','7 days / 7 ngày','Paid placement; no refund / Ghim trả phí; không hoàn tiền',50,'gold','{"durationSeconds":604800}',2);
