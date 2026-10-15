import sql from "mssql";

// Contrato esperado del lado de MZ Solutions: cada workspace de Fabric de un
// cliente expone una vista `dbo.portal_metrics` con estas columnas. El portal
// no conoce el modelado interno del datalake, solo esta vista.
type FabricMetricRow = {
  period: string;
  label: string;
  value_pct: number;
  sentiment: "positive" | "negative" | "neutral";
  sort_order: number;
};

function fabricConfig(sqlEndpoint: string, database: string): sql.config {
  return {
    server: sqlEndpoint,
    database,
    authentication: {
      type: "azure-active-directory-service-principal-secret",
      options: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        tenantId: process.env.AZURE_TENANT_ID!,
      },
    },
    options: { encrypt: true },
  };
}

export async function queryFabricMetrics(
  sqlEndpoint: string,
  database: string,
): Promise<FabricMetricRow[]> {
  const pool = await sql.connect(fabricConfig(sqlEndpoint, database));
  try {
    const result = await pool
      .request()
      .query<FabricMetricRow>(
        "SELECT period, label, value_pct, sentiment, sort_order FROM dbo.portal_metrics ORDER BY period DESC, sort_order ASC",
      );
    return result.recordset;
  } finally {
    await pool.close();
  }
}

// Consulta genérica, para probar conexión contra cualquier tabla/vista de
// Fabric (ej. las tablas gold) antes de definir un contrato fijo como el
// de queryFabricMetrics.
export async function queryFabricRaw(
  sqlEndpoint: string,
  database: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const pool = await sql.connect(fabricConfig(sqlEndpoint, database));
  try {
    const result = await pool.request().query(query);
    return result.recordset;
  } finally {
    await pool.close();
  }
}

// Para jobs que corren muchas consultas seguidas (ej. el sync de las 15
// tablas gold): abrir una sola conexión y reusarla, en vez de reconectar
// (con el handshake de Azure AD incluido) una vez por tabla.
export async function connectFabric(sqlEndpoint: string, database: string) {
  return sql.connect(fabricConfig(sqlEndpoint, database));
}
