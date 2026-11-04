-- Additive hardening for OPS paid_pin consumption + trust metadata.
-- DO NOT auto-apply to production. Does not rewrite historical pin/SEO rows.

ALTER TABLE "pin_entitlements"
  ADD COLUMN IF NOT EXISTS "ops_sku_code" varchar(80),
  ADD COLUMN IF NOT EXISTS "pricing_version" integer,
  ADD COLUMN IF NOT EXISTS "pricing_authority" text;

-- Allow OPS-catalog purchases without inventing shop_items rows.
-- Historical rows keep product_id → shop_items.
ALTER TABLE "pin_entitlements" ALTER COLUMN "product_id" DROP NOT NULL;

ALTER TABLE "pin_entitlements"
  DROP CONSTRAINT IF EXISTS "pin_entitlements_product_id_shop_items_id_fk";

ALTER TABLE "pin_entitlements" DROP CONSTRAINT IF EXISTS "pin_entitlements_valid";
ALTER TABLE "pin_entitlements"
  ADD CONSTRAINT "pin_entitlements_valid" CHECK (
    "ends_at" > "starts_at"
    AND "price" > 0
    AND "duration_seconds" > 0
    AND "balance_after" >= 0
    AND "status" IN ('active','expired','cancelled')
    AND (
      ("ops_sku_code" IS NOT NULL AND "pricing_authority" = 'ops-forum-pricing/1')
      OR "product_id" IS NOT NULL
    )
  );
