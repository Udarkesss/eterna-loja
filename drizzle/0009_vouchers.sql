ALTER TABLE "discount_codes" ADD COLUMN "target" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "level_key" text;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "min_purchase" integer;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "stacks_with_level" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "sent_via" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" DROP COLUMN "uses";