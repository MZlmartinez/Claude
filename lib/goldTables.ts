// Registro de tablas gold por cliente. Cada cliente tiene su propio
// Lakehouse en Fabric (ver lib/supabase/readonlyPg.ts getClientPool para el
// mismo patrón del lado de Postgres); dentro de cada Lakehouse, las tablas
// pueden vivir en distintos schemas — dbo es el default, el resto se
// declara en schemaOverrides. El destino en Supabase es siempre
// public.<table> (ver supabase/schema_gold*.sql).
export type ClientSlug = "deca" | "adecco";

type ClientGoldConfig = {
  tables: readonly string[];
  schemaOverrides: Record<string, string>;
};

const GOLD_CONFIG: Record<ClientSlug, ClientGoldConfig> = {
  deca: {
    tables: [
      "gold_meta_campanas",
      "gold_shopify_average_order_value_over_time",
      "gold_shopify_channel",
      "gold_shopify_checkout_conversion_rate_over_time",
      "gold_shopify_conversion_rate_over_time",
      "gold_shopify_customer_behavior",
      "gold_shopify_facturacion_inversion",
      "gold_shopify_new_vs_returning_customers",
      "gold_shopify_objetivos",
      "gold_shopify_orders_over_time",
      "gold_shopify_sessions_by_referrer",
      "gold_shopify_sessions_by_referrer_master",
      "gold_shopify_sessions_by_session_device_type",
      "gold_shopify_time",
      "gold_shopify_total_sales_by_product",
      "gold_influencers",
    ],
    // Casi todas viven en el esquema dbo del Lakehouse; gold_influencers es
    // la excepción (vive en el esquema influencers).
    schemaOverrides: { gold_influencers: "influencers" },
  },
  adecco: {
    tables: ["gold_prensa"],
    schemaOverrides: { gold_prensa: "prensa" },
  },
};

export function goldTablesFor(client: ClientSlug): readonly string[] {
  return GOLD_CONFIG[client].tables;
}

export function isGoldTableFor(client: ClientSlug, table: string): boolean {
  return GOLD_CONFIG[client].tables.includes(table);
}

export function sourceSchema(client: ClientSlug, table: string): string {
  return GOLD_CONFIG[client].schemaOverrides[table] ?? "dbo";
}
