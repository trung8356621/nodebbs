-- Additive Forum Pricing Catalog support (forum-pricing/1).
-- DO NOT auto-apply to production or both forum DBs from agents.
-- Operator applies per database after review.
-- Historical economics: backfill only from reliable transaction-level fields.
-- Never recalculate historical prices from the current catalog.

ALTER TABLE "seo_quotes"
  ADD COLUMN IF NOT EXISTS "unit_price" bigint,
  ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "total_credits" bigint,
  ADD COLUMN IF NOT EXISTS "price_version" integer,
  ADD COLUMN IF NOT EXISTS "credit_vnd" integer,
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "revoke_reason" text;

ALTER TABLE "seo_quotes" DROP CONSTRAINT IF EXISTS "seo_quote_status";
ALTER TABLE "seo_quotes"
  ADD CONSTRAINT "seo_quote_status"
  CHECK ("status" IN ('open','consumed','canceled','revoked'));

ALTER TABLE "seo_purchases"
  ADD COLUMN IF NOT EXISTS "unit_price" bigint,
  ADD COLUMN IF NOT EXISTS "quantity" integer,
  ADD COLUMN IF NOT EXISTS "total_credits" bigint,
  ADD COLUMN IF NOT EXISTS "quoted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "quote_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "pricing_provenance" text DEFAULT 'snapshot';

-- Backfill from reliable stored purchase/quote fields only (never comments).
-- paid_price / list_price / price_snapshot / quote timestamps are authoritative.
-- If a value cannot be reconstructed, leave NULL and set provenance unknown.

UPDATE "seo_purchases" p
SET
  "unit_price" = COALESCE(p."unit_price", p."paid_price"),
  "quantity" = COALESCE(p."quantity", 1),
  "total_credits" = COALESCE(p."total_credits", p."paid_price"),
  "quoted_at" = COALESCE(p."quoted_at", q."created_at", p."created_at"),
  "quote_expires_at" = COALESCE(p."quote_expires_at", q."expires_at"),
  "pricing_provenance" = CASE
    WHEN p."paid_price" IS NOT NULL AND p."price_snapshot" IS NOT NULL THEN COALESCE(p."pricing_provenance", 'legacy_backfill')
    ELSE COALESCE(p."pricing_provenance", 'unknown')
  END
FROM "seo_quotes" q
WHERE q."id" = p."quote_id"
  AND (
    p."unit_price" IS NULL
    OR p."quantity" IS NULL
    OR p."total_credits" IS NULL
    OR p."quoted_at" IS NULL
    OR p."quote_expires_at" IS NULL
  );

UPDATE "seo_quotes" q
SET
  "unit_price" = COALESCE(
    q."unit_price",
    NULLIF(q."price_snapshot"->>'salePriceCredit','')::bigint,
    NULLIF(q."price_snapshot"->>'unitPriceCredit','')::bigint
  ),
  "quantity" = COALESCE(q."quantity", 1),
  "total_credits" = COALESCE(
    q."total_credits",
    NULLIF(q."price_snapshot"->>'salePriceCredit','')::bigint,
    NULLIF(q."price_snapshot"->>'unitPriceCredit','')::bigint
  ),
  "price_version" = COALESCE(
    q."price_version",
    NULLIF(q."price_snapshot"->>'priceVersion','')::integer
  ),
  "status" = COALESCE(q."status", CASE WHEN EXISTS (
    SELECT 1 FROM "seo_purchases" p WHERE p."quote_id" = q."id"
  ) THEN 'consumed' ELSE 'open' END)
WHERE q."unit_price" IS NULL
   OR q."total_credits" IS NULL
   OR q."price_version" IS NULL
   OR q."status" IS NULL;
