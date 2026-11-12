CREATE TYPE "public"."cash_direction" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."cash_entry_type" AS ENUM('OPENING', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_date" date NOT NULL,
	"type" "cash_entry_type" NOT NULL,
	"direction" "cash_direction" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'CASH' NOT NULL,
	"to_mode" "payment_mode",
	"partner_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_entries_amount_positive" CHECK ("cash_entries"."amount" > 0),
	CONSTRAINT "cash_entries_transfer_modes" CHECK (("cash_entries"."type" = 'TRANSFER' AND "cash_entries"."to_mode" IS NOT NULL AND "cash_entries"."to_mode" <> "cash_entries"."payment_mode") OR ("cash_entries"."type" <> 'TRANSFER' AND "cash_entries"."to_mode" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entries_date_idx" ON "cash_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "cash_entries_type_idx" ON "cash_entries" USING btree ("type");