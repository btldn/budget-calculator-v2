DROP INDEX "category_limits_category_general_idx";--> statement-breakpoint
DROP INDEX "category_limits_category_user_idx";--> statement-breakpoint
-- Общих (ничьих) лимитов больше не будет — делим каждый поровну между
-- всеми пользователями, чтобы сумма (= семейный лимит) не изменилась.
INSERT INTO "category_limits" ("category_id", "user_id", "monthly_limit")
SELECT gl.category_id, u.id, round(gl.monthly_limit / (SELECT count(*) FROM "users"), 2)
FROM "category_limits" gl
CROSS JOIN "users" u
WHERE gl.user_id IS NULL;--> statement-breakpoint
DELETE FROM "category_limits" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "category_limits" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "category_limits_category_user_idx" ON "category_limits" USING btree ("category_id","user_id");