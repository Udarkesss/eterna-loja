CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"contact" jsonb NOT NULL,
	"origin" text NOT NULL,
	"order_id" uuid,
	"product_id" uuid,
	"variant_id" uuid,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"size" text,
	"image_url" text,
	"store_id" uuid,
	"price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"deposit" integer NOT NULL,
	"deposit_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"days" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"extensions" integer DEFAULT 0 NOT NULL,
	"extended_days" integer DEFAULT 0 NOT NULL,
	"more_time_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_number_unique" UNIQUE("number"),
	CONSTRAINT "reservations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kind" text DEFAULT 'purchase' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_customer_idx" ON "reservations" USING btree ("customer_id");