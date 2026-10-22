CREATE INDEX "ops_price_sync_created_idx" ON "ops_price_syncs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seo_events_created_idx" ON "seo_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seo_purchase_created_idx" ON "seo_purchases" USING btree ("created_at");