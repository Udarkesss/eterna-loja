ALTER TABLE "fittings" ADD COLUMN "package_key" text;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "extra_dresses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "payment_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "paid_at" timestamp with time zone;