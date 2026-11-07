ALTER TYPE "public"."expense_category" ADD VALUE 'WATER';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'STAFF_FOOD';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'FUEL';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'CLEANING';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'MOBILE_INTERNET';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'STATIONERY_PACKING';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'DONATION';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'COMMITTEE';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'BANK_CHARGES';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'LOAN_INTEREST';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'TAXES_FEES';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'LICENCE_FEES';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'ADVERTISING';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'HOSPITALITY';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'EQUIPMENT';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'MEDICAL';--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE 'FESTIVAL';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'JAZZCASH';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'EASYPAISA';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'CHEQUE';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'OTHER';--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"contact_person" varchar(120),
	"phone" varchar(30),
	"city" varchar(120),
	"address" text,
	"opening_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"status" "party_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "partners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"share_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"phone" varchar(30),
	"notes" text,
	"status" "party_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_share_pct_range" CHECK ("partners"."share_pct" >= 0 AND "partners"."share_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "sale_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sale_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"entry_date" date NOT NULL,
	"item_name" varchar(120),
	"quantity" numeric(12, 3),
	"unit" varchar(20),
	"rate" numeric(12, 2),
	"amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"received" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"payment_mode" "payment_mode",
	"reference" varchar(50),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_entries_amount_nonneg" CHECK ("sale_entries"."amount" >= 0),
	CONSTRAINT "sale_entries_received_nonneg" CHECK ("sale_entries"."received" >= 0),
	CONSTRAINT "sale_entries_not_empty" CHECK ("sale_entries"."amount" > 0 OR "sale_entries"."received" > 0)
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "size" varchar(40);--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "main_items" varchar(200);--> statement-breakpoint
ALTER TABLE "shop_expenses" ADD COLUMN "paid_by_partner_id" integer;--> statement-breakpoint
ALTER TABLE "sale_entries" ADD CONSTRAINT "sale_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sale_entries_customer_date_idx" ON "sale_entries" USING btree ("customer_id","entry_date");--> statement-breakpoint
CREATE INDEX "sale_entries_date_idx" ON "sale_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "sale_entries_item_idx" ON "sale_entries" USING btree ("item_name");--> statement-breakpoint
ALTER TABLE "shop_expenses" ADD CONSTRAINT "shop_expenses_paid_by_partner_id_partners_id_fk" FOREIGN KEY ("paid_by_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_expenses_partner_idx" ON "shop_expenses" USING btree ("paid_by_partner_id");