// Las 15 tablas gold del Lakehouse de Decathlon (mismo nombre en Fabric y
// en Supabase). Compartido entre la ruta de sync y las de diagnóstico.
export const GOLD_TABLES = [
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
] as const;

// Casi todas las tablas viven en el esquema dbo del Lakehouse; gold_influencers
// es la excepción (vive en el esquema influencers).
export const SOURCE_SCHEMA_OVERRIDES: Record<string, string> = {
  gold_influencers: "influencers",
};

export function sourceSchema(table: string) {
  return SOURCE_SCHEMA_OVERRIDES[table] ?? "dbo";
}
