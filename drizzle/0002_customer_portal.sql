CREATE TABLE "customer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "status" text DEFAULT 'Received' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "customer_update" text;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "updated_at" text;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_sessions_account_idx" ON "customer_sessions" USING btree ("customer_id","expires_at");--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_customer_time" ON "inquiries" USING btree ("customer_id","created_at","id");--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiry_status_check" CHECK ("inquiries"."status" in ('Received', 'In review', 'Resolved'));
--> statement-breakpoint
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.customers, public.customer_sessions FROM PUBLIC;
--> statement-breakpoint
DO $customer_guards$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated','service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.customers, public.customer_sessions FROM %I', client_role);
    END IF;
  END LOOP;
END $customer_guards$;
--> statement-breakpoint
UPDATE public.site_content SET title='What can we help you with?'
WHERE id='home' AND title='Find the right professional support, wherever you are.';
