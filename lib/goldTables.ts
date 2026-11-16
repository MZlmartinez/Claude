// Registro de tablas gold por cliente. Cada cliente tiene su propio
// Lakehouse en Fabric (ver lib/supabase/readonlyPg.ts getClientPool para el
// mismo patrón del lado de Postgres); dentro de cada Lakehouse, las tablas
// pueden vivir en distintos schemas — dbo es el default, el resto se
// declara en schemaOverrides.
//
// El nombre en Fabric NO siempre coincide con el nombre destino en
// Supabase: varios tipos de reporte (gold_influencers, gold_prensa) existen
// en más de un cliente con la MISMA estructura, cada uno en su propio
// Lakehouse — si los sincronizáramos tal cual, se pisarían entre sí en el
// schema public compartido de Supabase. La solución elegida es un sufijo
// de cliente en el nombre destino (gold_influencers_deca,
// gold_influencers_adecco); `sourceTableOverrides` mapea ese nombre
// destino de vuelta al nombre real en Fabric (sin sufijo, porque ahí cada
// cliente ya está aislado por tener su propio Lakehouse).
export type ClientSlug = "deca" | "adecco";

type ClientGoldConfig = {
  tables: readonly string[];
  schemaOverrides: Record<string, string>;
  // Nombre real de la tabla en Fabric, cuando difiere del nombre destino
  // en Supabase (por el sufijo de cliente). Si no está acá, se asume que
  // son el mismo nombre.
  sourceTableOverrides?: Record<string, string>;
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
      "gold_shopify_sessions_by_referrer_master",
      "gold_shopify_sessions_by_session_device_type",
      "gold_shopify_time",
      "gold_shopify_total_sales_by_product",
      "gold_influencers_deca",
      "gold_prensa_deca",
    ],
    // Casi todas viven en el esquema dbo del Lakehouse; influencers y
    // prensa son la excepción (viven en su propio esquema).
    schemaOverrides: {
      gold_influencers_deca: "influencers",
      gold_prensa_deca: "prensa",
    },
    sourceTableOverrides: {
      gold_influencers_deca: "gold_influencers",
      gold_prensa_deca: "gold_prensa",
    },
    selectColumnsOverrides: {
      // Mismo motivo que en Adecco: no necesitamos el "id" float de
      // Fabric, Postgres genera su propio uuid.
      gold_prensa_deca: [
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
        "inversion",
        "reach",
        "cpe_vap",
        "link_a_nota",
        "hipervinculo",
      ],
    },
  },
  adecco: {
    tables: ["gold_prensa_adecco", "gold_influencers_adecco"],
    schemaOverrides: {
      gold_prensa_adecco: "prensa",
      gold_influencers_adecco: "influencers",
    },
    sourceTableOverrides: {
      gold_prensa_adecco: "gold_prensa",
      gold_influencers_adecco: "gold_influencers",
    },
    selectColumnsOverrides: {
      // "id" queda afuera a propósito (no es por NaN, ya corregido en
      // origen — no la necesitamos igual, Postgres genera su propio uuid).
      gold_prensa_adecco: [
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
        "inversion",
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

// Nombre real de la tabla en Fabric para este destino (ver comentario de
// sourceTableOverrides arriba).
export function sourceTableName(client: ClientSlug, table: string): string {
  return GOLD_CONFIG[client].sourceTableOverrides?.[table] ?? table;
}

// null = "SELECT *" (default). Devuelve nombres de columna sin escapar —
// quien arma la query es responsable de poner los corchetes de T-SQL.
export function sourceSelectColumns(client: ClientSlug, table: string): readonly string[] | null {
  return GOLD_CONFIG[client].selectColumnsOverrides?.[table] ?? null;
}
