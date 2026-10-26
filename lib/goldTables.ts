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
  // Cuando está presente, el sync pide estas columnas en vez de "SELECT *".
  // Hace falta cuando alguna columna no se puede traer tal cual (ver
  // gold_prensa: su "id" float trae NaN/Infinity, que el SQL endpoint de
  // Fabric no puede convertir — rompe el SELECT * entero, no solo esa
  // fila). No la necesitamos igual: Postgres genera su propio uuid.
  selectColumnsOverrides?: Record<string, readonly string[]>;
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
    selectColumnsOverrides: {
      // "inversion" (float) también trae NaN/Infinity en algunas filas —
      // mismo problema que "id", afuera por ahora. Sacar esta línea en
      // cuanto se corrija el dato en el Dataflow/notebook de Fabric que
      // arma gold_prensa.
      gold_prensa: [
        "cliente",
        "marca",
        "fecha",
        "tier",
        "medio",
        "tipo_de_medio",
        "periodista",
        "vocero",
        "formato_contenido",
        "nacional_o_interior",
        "provincia",
        "industria",
        "campaña",
        "tema",
        "tono",
        "mención_gestión",
        "pago_organico",
        "reach",
        "cpe_vap",
        "link_a_nota",
        "hipervinculo",
      ],
    },
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

// null = "SELECT *" (default). Devuelve nombres de columna sin escapar —
// quien arma la query es responsable de poner los corchetes de T-SQL.
export function sourceSelectColumns(client: ClientSlug, table: string): readonly string[] | null {
  return GOLD_CONFIG[client].selectColumnsOverrides?.[table] ?? null;
}
