CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"co_cli" text,
	"role" text DEFAULT 'client' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"co_art" text NOT NULL,
	"qty" numeric(18, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_user_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_offer_lines" (
	"co_ofer" text NOT NULL,
	"co_cli" text NOT NULL,
	"porc_ofer" numeric(6, 3) NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_offer_lines_co_ofer_co_cli_pk" PRIMARY KEY("co_ofer","co_cli")
);
--> statement-breakpoint
CREATE TABLE "customer_offers" (
	"co_ofer" text PRIMARY KEY NOT NULL,
	"ofer_des" text NOT NULL,
	"fec_inic" timestamp with time zone NOT NULL,
	"fec_fin" timestamp with time zone NOT NULL,
	"tipo_d" text,
	"tipo_h" text,
	"co_cli_d" text,
	"co_cli_h" text,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"co_cli" text PRIMARY KEY NOT NULL,
	"cli_des" text NOT NULL,
	"rif" text,
	"email" text,
	"telefonos" text,
	"desc_glob" numeric(6, 3) DEFAULT '0' NOT NULL,
	"mont_cre" numeric(18, 2) DEFAULT '0' NOT NULL,
	"saldo" numeric(18, 2) DEFAULT '0' NOT NULL,
	"plaz_pag" integer DEFAULT 0 NOT NULL,
	"sincredito" boolean DEFAULT false NOT NULL,
	"co_seg" text,
	"tipo" text,
	"cond_1pct" boolean DEFAULT false NOT NULL,
	"inactivo" boolean DEFAULT false NOT NULL,
	"row_id_hex" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate" (
	"id" integer PRIMARY KEY NOT NULL,
	"usd_bs" numeric(18, 6) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"rows_applied" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_lines" (
	"co_ofer" text NOT NULL,
	"co_art" text NOT NULL,
	"porc_ofer" numeric(6, 3) NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "offer_lines_co_ofer_co_art_pk" PRIMARY KEY("co_ofer","co_art")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"co_ofer" text PRIMARY KEY NOT NULL,
	"ofer_des" text NOT NULL,
	"pos_ofer" integer NOT NULL,
	"fec_inic" timestamp with time zone NOT NULL,
	"fec_fin" timestamp with time zone NOT NULL,
	"co_seg_d" text,
	"co_seg_h" text,
	"co_cli_d" text,
	"co_cli_h" text,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"co_art" text NOT NULL,
	"art_des" text NOT NULL,
	"qty" numeric(18, 3) NOT NULL,
	"prec_vta1" numeric(18, 5) NOT NULL,
	"cascade" text NOT NULL,
	"unit_frozen" numeric(18, 5) NOT NULL,
	"line_net" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"app_user_id" uuid NOT NULL,
	"co_cli" text NOT NULL,
	"usd_bs_used" numeric(18, 6) NOT NULL,
	"applied_1pct" boolean DEFAULT false NOT NULL,
	"subtotal" numeric(18, 2) NOT NULL,
	"total" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_user_id" uuid NOT NULL,
	"co_cli" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"image_url" text NOT NULL,
	"note" text,
	"emailed_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_caps" (
	"co_art" text PRIMARY KEY NOT NULL,
	"porc_max" numeric(6, 3) NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_overrides" (
	"co_art" text PRIMARY KEY NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"photo_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"co_art" text PRIMARY KEY NOT NULL,
	"art_des" text NOT NULL,
	"co_lin" text,
	"co_cat" text,
	"co_subl" text,
	"co_prov" text,
	"uni_venta" text,
	"prec_vta1" numeric(18, 5) NOT NULL,
	"stock_act" numeric(18, 3) DEFAULT '0' NOT NULL,
	"stock_com" numeric(18, 3) DEFAULT '0' NOT NULL,
	"anulado" boolean DEFAULT false NOT NULL,
	"campo1" text,
	"row_id_hex" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" text PRIMARY KEY NOT NULL,
	"last_row_id_hex" text DEFAULT '0x0000000000000000' NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" text
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_co_cli_customers_co_cli_fk" FOREIGN KEY ("co_cli") REFERENCES "public"."customers"("co_cli") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_offer_lines" ADD CONSTRAINT "customer_offer_lines_co_ofer_customer_offers_co_ofer_fk" FOREIGN KEY ("co_ofer") REFERENCES "public"."customer_offers"("co_ofer") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_lines" ADD CONSTRAINT "offer_lines_co_ofer_offers_co_ofer_fk" FOREIGN KEY ("co_ofer") REFERENCES "public"."offers"("co_ofer") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_overrides" ADD CONSTRAINT "product_overrides_co_art_products_co_art_fk" FOREIGN KEY ("co_art") REFERENCES "public"."products"("co_art") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_users_co_cli" ON "app_users" USING btree ("co_cli");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_users_auth" ON "app_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cart_lines_cart_co_art" ON "cart_lines" USING btree ("cart_id","co_art");--> statement-breakpoint
CREATE INDEX "idx_carts_app_user_id" ON "carts" USING btree ("app_user_id");--> statement-breakpoint
CREATE INDEX "idx_offer_lines_co_art" ON "offer_lines" USING btree ("co_art");--> statement-breakpoint
CREATE INDEX "idx_offers_vigencia" ON "offers" USING btree ("fec_inic","fec_fin","pos_ofer");--> statement-breakpoint
CREATE INDEX "idx_order_lines_order_id" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_orders_number" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_app_user_id" ON "orders" USING btree ("app_user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_proofs_app_user_id" ON "payment_proofs" USING btree ("app_user_id");--> statement-breakpoint
CREATE INDEX "idx_products_anulado_co_lin" ON "products" USING btree ("anulado","co_lin");--> statement-breakpoint
CREATE INDEX "idx_products_art_des_fts" ON "products" USING gin (to_tsvector('spanish', "art_des"));