CREATE TABLE "pay_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"day_of_month" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paycheck_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paycheck_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paychecks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pay_schedule_id" uuid,
	"is_extra" boolean DEFAULT false NOT NULL,
	"received_on" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reserve_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_limits" ADD COLUMN "pay_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paycheck_id" uuid;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paycheck_allocations" ADD CONSTRAINT "paycheck_allocations_paycheck_id_paychecks_id_fk" FOREIGN KEY ("paycheck_id") REFERENCES "public"."paychecks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paycheck_allocations" ADD CONSTRAINT "paycheck_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paychecks" ADD CONSTRAINT "paychecks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paychecks" ADD CONSTRAINT "paychecks_pay_schedule_id_pay_schedules_id_fk" FOREIGN KEY ("pay_schedule_id") REFERENCES "public"."pay_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paychecks_user_received_on_idx" ON "paychecks" USING btree ("user_id","received_on");--> statement-breakpoint
ALTER TABLE "category_limits" ADD CONSTRAINT "category_limits_pay_schedule_id_pay_schedules_id_fk" FOREIGN KEY ("pay_schedule_id") REFERENCES "public"."pay_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paycheck_id_paychecks_id_fk" FOREIGN KEY ("paycheck_id") REFERENCES "public"."paychecks"("id") ON DELETE no action ON UPDATE no action;