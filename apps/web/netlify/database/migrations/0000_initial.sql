CREATE TYPE "public"."connection_status" AS ENUM('active', 'disabled', 'removed');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('fhsa', 'tfsa', 'rrsp', 'non_registered', 'resp', 'other');--> statement-breakpoint
CREATE TYPE "public"."order_batch_kind" AS ENUM('invest', 'withdraw');--> statement-breakpoint
CREATE TYPE "public"."order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"snaptrade_subject" text,
	"target_symbol_id" text,
	"target_ticker" text,
	"target_name" text,
	"target_currency" char(3) DEFAULT 'CAD' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_snaptrade_subject_unique" UNIQUE("snaptrade_subject")
);
--> statement-breakpoint
CREATE TABLE "brokerage_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'snaptrade' NOT NULL,
	"access_token_enc" "bytea" NOT NULL,
	"refresh_token_enc" "bytea" NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"snaptrade_authorization_id" text NOT NULL,
	"brokerage_slug" text NOT NULL,
	"brokerage_name" text NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"can_trade" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_snaptradeAuthorizationId_unique" UNIQUE("snaptrade_authorization_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"snaptrade_account_id" text NOT NULL,
	"name" text NOT NULL,
	"number_masked" text NOT NULL,
	"raw_type" text,
	"account_type" "account_type" DEFAULT 'other' NOT NULL,
	"included" boolean DEFAULT false NOT NULL,
	"contribution_rank" integer DEFAULT 0 NOT NULL,
	"withdrawal_rank" integer DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'CAD' NOT NULL,
	"last_value_cents" bigint,
	"cash_cents" bigint,
	"cash_as_of" timestamp with time zone,
	"status_raw" text,
	"is_paper" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_snaptradeAccountId_unique" UNIQUE("snaptrade_account_id")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"universal_symbol_id" text NOT NULL,
	"ticker" text NOT NULL,
	"description" text,
	"units" numeric(20, 6) NOT NULL,
	"price_cents" bigint,
	"currency" char(3) DEFAULT 'CAD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" "account_type" NOT NULL,
	"room_cents" bigint NOT NULL,
	"as_of" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"snaptrade_activity_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'CAD' NOT NULL,
	"trade_date" date NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_activities_snaptradeActivityId_unique" UNIQUE("snaptrade_activity_id")
);
--> statement-breakpoint
CREATE TABLE "order_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "order_batch_kind" NOT NULL,
	"requested_cents" bigint,
	"price_cents" bigint NOT NULL,
	"ticker" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"side" "order_side" NOT NULL,
	"universal_symbol_id" text NOT NULL,
	"ticker" text NOT NULL,
	"units" numeric(20, 6) NOT NULL,
	"estimated_cents" bigint NOT NULL,
	"snaptrade_trade_id" text,
	"brokerage_order_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"error" text,
	"placed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brokerage_tokens" ADD CONSTRAINT "brokerage_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_room" ADD CONSTRAINT "contribution_room_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_activities" ADD CONSTRAINT "account_activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_batches" ADD CONSTRAINT "order_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_order_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."order_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brokerage_tokens_user_provider_unique" ON "brokerage_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_connection_id_idx" ON "accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_account_symbol_unique" ON "positions" USING btree ("account_id","universal_symbol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_room_user_type_unique" ON "contribution_room" USING btree ("user_id","account_type");--> statement-breakpoint
CREATE INDEX "account_activities_account_id_idx" ON "account_activities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "orders_batch_id_idx" ON "orders" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "orders_account_id_idx" ON "orders" USING btree ("account_id");