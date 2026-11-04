CREATE TABLE "loyalty_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"amount" integer,
	"store_id" uuid,
	"reason" text,
	"actor_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "origin" text DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "level_override" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "level_override_year" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "level_reason" text;--> statement-breakpoint
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_entries_customer_idx" ON "loyalty_entries" USING btree ("customer_id","year");