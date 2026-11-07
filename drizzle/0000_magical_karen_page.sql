CREATE TYPE "public"."bill_status" AS ENUM('PENDING', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('RENT', 'ELECTRICITY', 'TEA_MEALS', 'SALARY', 'MAINTENANCE', 'TRANSPORT', 'MISCELLANEOUS');--> statement-breakpoint
CREATE TYPE "public"."party_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'BANK');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('BILL', 'PAYMENT', 'ADVANCE', 'RECEIPT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"item_name" varchar(120) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" varchar(20) DEFAULT 'kg' NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "bill_items_quantity_positive" CHECK ("bill_items"."quantity" > 0),
	CONSTRAINT "bill_items_rate_nonneg" CHECK ("bill_items"."rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"party_id" integer NOT NULL,
	"bill_date" date NOT NULL,
	"gari_number" varchar(50),
	"gross_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"commission_pct" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"freight" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"labour" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"market_fee" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"munshiyana" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"other_expense" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"other_expense_note" varchar(120),
	"total_expenses" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"advance_adjusted" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"final_payable" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"status" "bill_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_commission_pct_range" CHECK ("bills"."commission_pct" >= 0 AND "bills"."commission_pct" <= 100),
	CONSTRAINT "bills_gross_nonneg" CHECK ("bills"."gross_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"contact_person" varchar(120),
	"phone" varchar(30),
	"address" text,
	"commission_rate" numeric(5, 2) DEFAULT '6.00' NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"default_freight" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"default_labour" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"status" "party_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parties_commission_rate_range" CHECK ("parties"."commission_rate" >= 0 AND "parties"."commission_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "party_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "party_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"party_id" integer NOT NULL,
	"txn_date" date NOT NULL,
	"type" "transaction_type" NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"reference_id" integer,
	"payment_mode" "payment_mode",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_transactions_debit_nonneg" CHECK ("party_transactions"."debit" >= 0),
	CONSTRAINT "party_transactions_credit_nonneg" CHECK ("party_transactions"."credit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shop_expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shop_expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"expense_date" date NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'CASH' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_expenses_amount_positive" CHECK ("shop_expenses"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_transactions" ADD CONSTRAINT "party_transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_transactions" ADD CONSTRAINT "party_transactions_reference_id_bills_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bills_party_id_idx" ON "bills" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "bills_bill_date_idx" ON "bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("name");--> statement-breakpoint
CREATE INDEX "parties_status_idx" ON "parties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "party_transactions_party_date_idx" ON "party_transactions" USING btree ("party_id","txn_date");--> statement-breakpoint
CREATE INDEX "party_transactions_reference_idx" ON "party_transactions" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "party_transactions_type_idx" ON "party_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "shop_expenses_date_idx" ON "shop_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "shop_expenses_category_idx" ON "shop_expenses" USING btree ("category");