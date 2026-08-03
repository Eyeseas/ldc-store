ALTER TABLE "orders" ADD COLUMN "payment_review_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_review_trade_no" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_review_at" timestamp with time zone;