CREATE TABLE "policy_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"forum_id" text NOT NULL,
	"user_id" integer,
	"content_type" text NOT NULL,
	"content_id" integer,
	"action" text NOT NULL,
	"rule_ids" jsonb NOT NULL,
	"reason" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"action" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"target" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"scanned" integer DEFAULT 0 NOT NULL,
	"affected" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"success" boolean NOT NULL,
	"version" integer,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"scope" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"source" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "policy_decisions_created_idx" ON "policy_decisions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_rules_identity_idx" ON "policy_rules" USING btree ("scope","type","value");
--> statement-breakpoint
CREATE UNIQUE INDEX policy_scans_one_active_idx ON policy_scans ((true)) WHERE status IN ('pending','running');
