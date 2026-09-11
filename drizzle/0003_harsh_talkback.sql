CREATE TABLE "category_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"user_id" uuid,
	"monthly_limit" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_limits" ADD CONSTRAINT "category_limits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_limits" ADD CONSTRAINT "category_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_limits_category_user_idx" ON "category_limits" USING btree ("category_id","user_id") WHERE "category_limits"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "category_limits_category_general_idx" ON "category_limits" USING btree ("category_id") WHERE "category_limits"."user_id" is null;--> statement-breakpoint
INSERT INTO "category_limits" ("category_id", "user_id", "monthly_limit")
SELECT "id", NULL, "monthly_limit" FROM "categories" WHERE "monthly_limit" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "monthly_limit";