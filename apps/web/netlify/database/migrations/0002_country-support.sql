CREATE TYPE "public"."country" AS ENUM('ca', 'us');--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'hsa';--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'roth_ira';--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'ira';--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'taxable';--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'workplace';--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'plan_529';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" "country";