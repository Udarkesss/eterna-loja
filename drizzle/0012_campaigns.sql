CREATE TABLE "campaign_items" (
	"campaign_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"percent" integer,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "campaign_items_campaign_id_product_id_pk" PRIMARY KEY("campaign_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"phrase" jsonb,
	"kind" text DEFAULT 'normal' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"discount_mode" text DEFAULT 'uniform' NOT NULL,
	"percent" integer DEFAULT 30 NOT NULL,
	"top_bar" boolean DEFAULT true NOT NULL,
	"home_placement" text DEFAULT 'after' NOT NULL,
	"own_page" boolean DEFAULT true NOT NULL,
	"countdown" boolean DEFAULT true NOT NULL,
	"colors" jsonb,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;