import { NextResponse } from "next/server";
import { connectFabric } from "@/lib/fabric";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Lista de tablas gold a sincronizar completas (nombre igual en Fabric y en
// Supabase). Estrategia: borrar y recargar por profile_id en cada corrida,
// porque la mayoría de estas tablas no tiene una clave de fila natural.
const GOLD_TABLES = [
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
] as const;

// Única diferencia de nombres entre Fabric y Supabase (Postgres no puede
// tener una columna sin comillas en mayúsculas/minúsculas mixtas cómodamente).
const COLUMN_RENAMES: Record<string, Record<string, string>> = {
  gold_shopify_time: { UltimoPeriodo: "ultimo_periodo" },
};

function renameColumns(table: string, row: Record<string, unknown>) {
  const renames = COLUMN_RENAMES[table];
  if (!renames) return row;
  const renamed: Record<string, unknown> = { ...row };
  for (const [from, to] of Object.entries(renames)) {
    if (from in renamed) {
      renamed[to] = renamed[from];
      delete renamed[from];
    }
  }
  return renamed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("key") !== process.env.TEST_ROUTE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sqlEndpoint = searchParams.get("endpoint");
  const database = searchParams.get("database");
  const profileId = searchParams.get("profileId");

  if (!sqlEndpoint || !database || !profileId) {
    return NextResponse.json(
      { error: "faltan los parámetros endpoint, database y profileId" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  async function syncTable(table: string) {
    try {
      // Una request por tabla, pero todas corren en paralelo sobre el
      // mismo pool (mssql maneja varias conexiones internamente).
      const fabricResult = await pool.request().query(`SELECT * FROM dbo.${table}`);
      const fabricRows = fabricResult.recordset as Record<string, unknown>[];

      await supabase.from(table).delete().eq("profile_id", profileId);

      if (fabricRows.length > 0) {
        const rowsToInsert = fabricRows.map((row) => ({
          ...renameColumns(table, row),
          profile_id: profileId,
        }));

        const { error } = await supabase.from(table).insert(rowsToInsert);
        if (error) throw new Error(error.message);
      }

      return [table, { rows: fabricRows.length }] as const;
    } catch (error) {
      return [table, { rows: 0, error: String(error) }] as const;
    }
  }

  let results: Record<string, { rows: number; error?: string }>;
  try {
    const entries = await Promise.all(GOLD_TABLES.map(syncTable));
    results = Object.fromEntries(entries);
  } finally {
    await pool.close();
  }

  return NextResponse.json({ ok: true, results });
}
