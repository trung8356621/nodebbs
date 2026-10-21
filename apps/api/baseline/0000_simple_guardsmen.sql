CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"token_type" varchar(50),
	"scope" text,
	"id_token" text,
	CONSTRAINT "accounts_provider_account_unique" UNIQUE("provider","provider_account_id"),
	CONSTRAINT "accounts_user_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blocked_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"blocked_user_id" integer NOT NULL,
	"reason" text,
	CONSTRAINT "unique_block" UNIQUE("user_id","blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "captcha_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "captcha_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"provider" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"display_name" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	"config" text,
	"enabled_scenes" text,
	CONSTRAINT "captcha_providers_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user1_id" integer NOT NULL,
	"user2_id" integer NOT NULL,
	"last_message_id" integer,
	"last_message_at" timestamp with time zone,
	"user1_unread_count" integer DEFAULT 0 NOT NULL,
	"user2_unread_count" integer DEFAULT 0 NOT NULL,
	"is_deleted_by_user1" boolean DEFAULT false NOT NULL,
	"is_deleted_by_user2" boolean DEFAULT false NOT NULL,
	CONSTRAINT "conversations_user_pair" UNIQUE("user1_id","user2_id")
);
--> statement-breakpoint
CREATE TABLE "email_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"provider" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"smtp_host" varchar(255),
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true,
	"smtp_user" varchar(255),
	"smtp_password" text,
	"from_email" varchar(255),
	"from_name" varchar(255),
	"api_key" text,
	"api_endpoint" varchar(500),
	"additional_config" text,
	"display_name" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "email_providers_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255),
	"url" varchar(500) NOT NULL,
	"category" varchar(50) NOT NULL,
	"mimetype" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"provider" varchar(50) DEFAULT 'local',
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "follows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"follower_id" integer NOT NULL,
	"following_id" integer NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_unique" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invitation_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"code" varchar(32) NOT NULL,
	"created_by" integer NOT NULL,
	"used_by" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"used_at" timestamp with time zone,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invitation_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invitation_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"daily_limit" integer DEFAULT 1 NOT NULL,
	"max_uses_per_code" integer DEFAULT 1 NOT NULL,
	"expire_days" integer DEFAULT 30 NOT NULL,
	"points_cost" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invitation_rules_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"is_deleted_by_sender" boolean DEFAULT false NOT NULL,
	"is_deleted_by_recipient" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"triggered_by_user_id" integer,
	"topic_id" integer,
	"post_id" integer,
	"message" text NOT NULL,
	"metadata" text,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oauth_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"provider" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"client_id" varchar(255),
	"client_secret" text,
	"callback_url" varchar(500),
	"scope" text,
	"additional_config" text,
	"display_name" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "oauth_providers_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "oplogs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oplogs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"action" varchar(50) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" integer NOT NULL,
	"moderator_id" integer NOT NULL,
	"reason" text,
	"previous_status" varchar(20),
	"new_status" varchar(20),
	"metadata" text,
	"ip" varchar(45),
	"target_label" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"title" varchar(255) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"standalone" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "qr_login_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "qr_login_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"request_id" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"user_id" integer,
	"token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_ip" varchar(45),
	CONSTRAINT "qr_login_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"report_type" varchar(20) NOT NULL,
	"target_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"resolver_note" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"description" text,
	"updated_by" integer,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"username" varchar(50) NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"phone" varchar(20),
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(255),
	"bio" text,
	"avatar" varchar(500),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_until" timestamp with time zone,
	"banned_reason" text,
	"banned_by" integer,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"last_seen_at" timestamp,
	"message_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"content_visibility" varchar(20) DEFAULT 'everyone' NOT NULL,
	"registration_ip" varchar(45),
	"last_login_ip" varchar(45),
	"username_changed_at" timestamp,
	"username_change_count" integer DEFAULT 0 NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"deletion_reason" text,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"type" varchar(50) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "post_rewards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "post_rewards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"post_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(20) DEFAULT 'credits',
	"message" text
);
--> statement-breakpoint
CREATE TABLE "user_check_ins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_check_ins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"last_check_in_date" timestamp with time zone,
	"check_in_streak" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_check_ins_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shop_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"type" varchar(20) NOT NULL,
	"consume_type" varchar(20) DEFAULT 'non_consumable' NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"currency_code" varchar(20) DEFAULT 'credits' NOT NULL,
	"image_url" varchar(500),
	"stock" integer,
	"max_own" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" text,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_item_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_item_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"user_item_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(20),
	"target_id" integer,
	"quantity_used" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon_url" varchar(500) NOT NULL,
	"category" varchar(50) DEFAULT 'achievement' NOT NULL,
	"unlock_condition" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" text,
	CONSTRAINT "badges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now(),
	"source" varchar(50),
	"is_displayed" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"currency_code" varchar(20) NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"total_earned" bigint DEFAULT 0 NOT NULL,
	"total_spent" bigint DEFAULT 0 NOT NULL,
	"is_frozen" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sys_accounts_user_id_currency_code_unique" UNIQUE("user_id","currency_code")
);
--> statement-breakpoint
CREATE TABLE "sys_currencies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_currencies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"code" varchar(20) NOT NULL,
	"name" varchar(50) NOT NULL,
	"symbol" varchar(10),
	"precision" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" text,
	"config" text,
	CONSTRAINT "sys_currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sys_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"currency_code" varchar(20) NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"related_user_id" integer,
	"description" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "ad_slots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ad_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"width" integer,
	"height" integer,
	"max_ads" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ad_slots_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"slot_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"content" text,
	"link_url" varchar(500),
	"target_blank" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "message_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"channel" varchar(20) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" text,
	"display_name" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "message_providers_channel_provider" UNIQUE("channel","provider")
);
--> statement-breakpoint
CREATE TABLE "storage_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "storage_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"type" varchar(20) DEFAULT 'local' NOT NULL,
	"slug" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" text,
	"display_name" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"slug" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"module" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50),
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permissions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "permissions_module_action_unique" UNIQUE("module","action","resource_type")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "role_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"conditions" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "role_permissions_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20),
	"icon" varchar(50),
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_displayed" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_roles_unique" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "moderation_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"target_type" varchar(40) NOT NULL,
	"target_id" integer NOT NULL,
	"field" varchar(40),
	"submitted_by" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"snapshot" jsonb,
	"reason" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "emoji_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emoji_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"size" integer,
	CONSTRAINT "emoji_groups_name_unique" UNIQUE("name"),
	CONSTRAINT "emoji_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "emojis" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emojis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"group_id" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"url" varchar(500) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "emojis_group_code_unique" UNIQUE("group_id","code")
);
--> statement-breakpoint
CREATE TABLE "attachment_purchases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attachment_purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"attachment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount_paid" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "bookmarks_user_id_topic_id_unique" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#000000',
	"icon" varchar(50),
	"parent_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "likes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	CONSTRAINT "likes_user_id_post_id_unique" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "lotteries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lotteries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"topic_id" integer,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"winners_count" integer NOT NULL,
	"points_per_winner" integer DEFAULT 0 NOT NULL,
	"prize_description" text,
	"prize_items" jsonb,
	"min_account_days" integer DEFAULT 0 NOT NULL,
	"require_reply" boolean DEFAULT false NOT NULL,
	"draw_at" timestamp with time zone NOT NULL,
	"drawn_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"participants_count" integer DEFAULT 0 NOT NULL,
	"frozen_points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lottery_ledger_refs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lottery_ledger_refs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"lottery_id" integer NOT NULL,
	"reference_type" varchar(20) NOT NULL,
	"reference_id" varchar(100) NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lottery_participants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lottery_participants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"lottery_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"prize_item" text
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"poll_id" integer NOT NULL,
	"text" text NOT NULL,
	"display_order" integer NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "polls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"topic_id" integer,
	"user_id" integer NOT NULL,
	"question" text NOT NULL,
	"selection_type" varchar(20) NOT NULL,
	"max_choices" integer,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"total_voters" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"topic_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"raw_content" text NOT NULL,
	"post_number" integer NOT NULL,
	"reply_to_post_id" integer,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"approval_status" varchar(20) DEFAULT 'approved' NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" integer,
	"edited_at" timestamp,
	"edit_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "subscriptions_user_id_topic_id_unique" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"topic_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topic_attachment_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topic_attachment_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"attachment_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_attachments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topic_attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"topic_id" integer,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"description" text,
	"policy" varchar(20) DEFAULT 'none' NOT NULL,
	"points_cost" integer DEFAULT 0 NOT NULL,
	"allowed_role_ids" jsonb
);
--> statement-breakpoint
CREATE TABLE "topic_tags" (
	"topic_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "topic_tags_topic_id_tag_id_unique" UNIQUE("topic_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"category_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"approval_status" varchar(20) DEFAULT 'approved' NOT NULL,
	"last_post_at" timestamp,
	"last_post_user_id" integer
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oplogs" ADD CONSTRAINT "oplogs_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_login_requests" ADD CONSTRAINT "qr_login_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rewards" ADD CONSTRAINT "post_rewards_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rewards" ADD CONSTRAINT "post_rewards_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rewards" ADD CONSTRAINT "post_rewards_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_check_ins" ADD CONSTRAINT "user_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_logs" ADD CONSTRAINT "user_item_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_logs" ADD CONSTRAINT "user_item_logs_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_logs" ADD CONSTRAINT "user_item_logs_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_accounts" ADD CONSTRAINT "sys_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_accounts" ADD CONSTRAINT "sys_accounts_currency_code_sys_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."sys_currencies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_transactions" ADD CONSTRAINT "sys_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_transactions" ADD CONSTRAINT "sys_transactions_account_id_sys_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."sys_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_transactions" ADD CONSTRAINT "sys_transactions_currency_code_sys_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."sys_currencies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sys_transactions" ADD CONSTRAINT "sys_transactions_related_user_id_users_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_slot_id_ad_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."ad_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emojis" ADD CONSTRAINT "emojis_group_id_emoji_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."emoji_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_purchases" ADD CONSTRAINT "attachment_purchases_attachment_id_topic_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."topic_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_purchases" ADD CONSTRAINT "attachment_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_ledger_refs" ADD CONSTRAINT "lottery_ledger_refs_lottery_id_lotteries_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lotteries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_ledger_refs" ADD CONSTRAINT "lottery_ledger_refs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_participants" ADD CONSTRAINT "lottery_participants_lottery_id_lotteries_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lotteries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_participants" ADD CONSTRAINT "lottery_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_reply_to_post_id_posts_id_fk" FOREIGN KEY ("reply_to_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_attachment_files" ADD CONSTRAINT "topic_attachment_files_attachment_id_topic_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."topic_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_attachment_files" ADD CONSTRAINT "topic_attachment_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_attachments" ADD CONSTRAINT "topic_attachments_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_attachments" ADD CONSTRAINT "topic_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_last_post_user_id_users_id_fk" FOREIGN KEY ("last_post_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_provider_idx" ON "accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "blocked_users_user_idx" ON "blocked_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "blocked_users_blocked_user_idx" ON "blocked_users" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "captcha_providers_provider_idx" ON "captcha_providers" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "captcha_providers_is_enabled_idx" ON "captcha_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "conversations_user1_idx" ON "conversations" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "conversations_user2_idx" ON "conversations" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "email_providers_provider_idx" ON "email_providers" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "email_providers_is_enabled_idx" ON "email_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "email_providers_display_order_idx" ON "email_providers" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "files_user_id_idx" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_category_idx" ON "files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "invitation_codes_code_idx" ON "invitation_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invitation_codes_created_by_idx" ON "invitation_codes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invitation_codes_used_by_idx" ON "invitation_codes" USING btree ("used_by");--> statement-breakpoint
CREATE INDEX "invitation_codes_status_idx" ON "invitation_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitation_codes_created_at_idx" ON "invitation_codes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invitation_codes_expires_at_idx" ON "invitation_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitation_rules_role_idx" ON "invitation_rules" USING btree ("role");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "messages_is_read_idx" ON "messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "oauth_providers_provider_idx" ON "oauth_providers" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "oauth_providers_is_enabled_idx" ON "oauth_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "oauth_providers_display_order_idx" ON "oauth_providers" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "oplogs_action_idx" ON "oplogs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "oplogs_target_type_idx" ON "oplogs" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "oplogs_target_id_idx" ON "oplogs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "oplogs_moderator_idx" ON "oplogs" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "oplogs_created_at_idx" ON "oplogs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pages_type_idx" ON "pages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pages_is_published_idx" ON "pages" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "qr_login_requests_request_id_idx" ON "qr_login_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "qr_login_requests_status_idx" ON "qr_login_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qr_login_requests_expires_at_idx" ON "qr_login_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "qr_login_requests_user_id_idx" ON "qr_login_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_type_idx" ON "reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_value_idx" ON "verifications" USING btree ("value");--> statement-breakpoint
CREATE INDEX "verifications_type_idx" ON "verifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "verifications_user_id_idx" ON "verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_type_identifier_idx" ON "verifications" USING btree ("type","identifier");--> statement-breakpoint
CREATE INDEX "post_rewards_post_idx" ON "post_rewards" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_rewards_from_user_idx" ON "post_rewards" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "post_rewards_to_user_idx" ON "post_rewards" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "post_rewards_created_at_idx" ON "post_rewards" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_check_ins_user_idx" ON "user_check_ins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_items_type_idx" ON "shop_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "shop_items_is_active_idx" ON "shop_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "shop_items_display_order_idx" ON "shop_items" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "shop_items_consume_type_idx" ON "shop_items" USING btree ("consume_type");--> statement-breakpoint
CREATE INDEX "user_item_logs_user_id_idx" ON "user_item_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_item_logs_item_id_idx" ON "user_item_logs" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "user_item_logs_user_item_id_idx" ON "user_item_logs" USING btree ("user_item_id");--> statement-breakpoint
CREATE INDEX "user_item_logs_action_idx" ON "user_item_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_item_logs_status_idx" ON "user_item_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_item_logs_created_at_idx" ON "user_item_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_items_user_item_uniq" ON "user_items" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "user_items_user_idx" ON "user_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_items_item_idx" ON "user_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "user_items_equipped_idx" ON "user_items" USING btree ("is_equipped");--> statement-breakpoint
CREATE INDEX "user_items_status_idx" ON "user_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "badges_slug_idx" ON "badges" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "badges_category_idx" ON "badges" USING btree ("category");--> statement-breakpoint
CREATE INDEX "badges_is_active_idx" ON "badges" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "badges_display_order_idx" ON "badges" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "user_badges_user_idx" ON "user_badges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_badges_badge_idx" ON "user_badges" USING btree ("badge_id");--> statement-breakpoint
CREATE INDEX "user_badges_earned_at_idx" ON "user_badges" USING btree ("earned_at");--> statement-breakpoint
CREATE INDEX "sys_accounts_user_idx" ON "sys_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sys_accounts_currency_idx" ON "sys_accounts" USING btree ("currency_code");--> statement-breakpoint
CREATE INDEX "sys_currencies_code_idx" ON "sys_currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sys_transactions_user_idx" ON "sys_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sys_transactions_account_idx" ON "sys_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sys_transactions_currency_idx" ON "sys_transactions" USING btree ("currency_code");--> statement-breakpoint
CREATE INDEX "sys_transactions_type_idx" ON "sys_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sys_transactions_ref_idx" ON "sys_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "sys_transactions_created_at_idx" ON "sys_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ad_slots_code_idx" ON "ad_slots" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ad_slots_is_active_idx" ON "ad_slots" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ads_slot_id_idx" ON "ads" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "ads_type_idx" ON "ads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ads_is_active_idx" ON "ads" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ads_priority_idx" ON "ads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ads_start_at_idx" ON "ads" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "ads_end_at_idx" ON "ads" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "message_providers_channel_idx" ON "message_providers" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "message_providers_is_enabled_idx" ON "message_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "message_providers_display_order_idx" ON "message_providers" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "storage_providers_slug_idx" ON "storage_providers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "storage_providers_is_enabled_idx" ON "storage_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "permissions_slug_idx" ON "permissions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "permissions_module_idx" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "permissions_action_idx" ON "permissions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "roles_slug_idx" ON "roles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "roles_is_system_idx" ON "roles" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "roles_is_default_idx" ON "roles" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "roles_priority_idx" ON "roles" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_expires_at_idx" ON "user_roles" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "moderation_items_status_idx" ON "moderation_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_items_target_idx" ON "moderation_items" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_items_submitted_by_idx" ON "moderation_items" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "moderation_items_created_at_idx" ON "moderation_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "emoji_groups_slug_idx" ON "emoji_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "emoji_groups_order_idx" ON "emoji_groups" USING btree ("order");--> statement-breakpoint
CREATE INDEX "emoji_groups_is_active_idx" ON "emoji_groups" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "emojis_group_id_idx" ON "emojis" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "emojis_code_idx" ON "emojis" USING btree ("code");--> statement-breakpoint
CREATE INDEX "emojis_order_idx" ON "emojis" USING btree ("order");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_purchases_att_user_idx" ON "attachment_purchases" USING btree ("attachment_id","user_id");--> statement-breakpoint
CREATE INDEX "attachment_purchases_user_idx" ON "attachment_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_topic_idx" ON "bookmarks" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_is_featured_idx" ON "categories" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "likes_user_idx" ON "likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "likes_post_idx" ON "likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "lotteries_topic_idx" ON "lotteries" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "lotteries_user_idx" ON "lotteries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lotteries_status_drawat_idx" ON "lotteries" USING btree ("status","draw_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_ledger_refs_type_ref_idx" ON "lottery_ledger_refs" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "lottery_ledger_refs_lottery_idx" ON "lottery_ledger_refs" USING btree ("lottery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_participants_lottery_user_idx" ON "lottery_participants" USING btree ("lottery_id","user_id");--> statement-breakpoint
CREATE INDEX "lottery_participants_winner_idx" ON "lottery_participants" USING btree ("lottery_id","is_winner");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_options_poll_order_idx" ON "poll_options" USING btree ("poll_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_poll_user_option_idx" ON "poll_votes" USING btree ("poll_id","user_id","option_id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_option_idx" ON "poll_votes" USING btree ("poll_id","option_id");--> statement-breakpoint
CREATE INDEX "polls_topic_idx" ON "polls" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "polls_user_idx" ON "polls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_topic_idx" ON "posts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "posts_user_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_reply_to_idx" ON "posts" USING btree ("reply_to_post_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_topic_idx" ON "subscriptions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "topic_attachment_files_attachment_idx" ON "topic_attachment_files" USING btree ("attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_attachment_files_file_idx" ON "topic_attachment_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "topic_attachments_topic_idx" ON "topic_attachments" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_attachments_user_idx" ON "topic_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_tags_topic_idx" ON "topic_tags" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_tags_tag_idx" ON "topic_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "topics_category_idx" ON "topics" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "topics_user_idx" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "topics_last_post_at_idx" ON "topics" USING btree ("last_post_at");