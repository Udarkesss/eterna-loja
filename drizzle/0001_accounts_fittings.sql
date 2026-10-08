ALTER TABLE "audit_logs" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "public_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "locale" text DEFAULT 'pt' NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "duration_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "confirmed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fittings" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fittings" ADD CONSTRAINT "fittings_confirmed_by_id_staff_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fittings_customer_idx" ON "fittings" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "fittings" ADD CONSTRAINT "fittings_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "fittings" ADD CONSTRAINT "fittings_public_token_unique" UNIQUE("public_token");