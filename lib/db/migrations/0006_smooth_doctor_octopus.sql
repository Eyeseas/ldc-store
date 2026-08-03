CREATE TYPE "public"."payment_protocol" AS ENUM('epay', 'ldcpay');--> statement-breakpoint
CREATE TYPE "public"."refund_attempt_status" AS ENUM('processing', 'succeeded', 'failed', 'uncertain');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_protocol" "payment_protocol" DEFAULT 'epay' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_attempt_status" "refund_attempt_status";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_attempted_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_response_code" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_response_message" text;--> statement-breakpoint
CREATE INDEX "orders_refund_attempt_status_idx" ON "orders" USING btree ("refund_attempt_status");