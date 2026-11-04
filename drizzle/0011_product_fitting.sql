ALTER TABLE "products" ADD COLUMN "fitting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "products" SET "fitting" = true WHERE "id" IN (SELECT pc."product_id" FROM "product_categories" pc JOIN "categories" c ON c."id" = pc."category_id" WHERE c."slug" = 'vestidos-de-noiva');
