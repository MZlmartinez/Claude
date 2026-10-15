import { NextResponse } from "next/server";
import { connectFabric } from "@/lib/fabric";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOLD_TABLES } from "@/lib/goldTables";

export const maxDuration = 60;

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
  const onlyTable = searchParams.get("table");

  if (!sqlEndpoint || !database || !profileId) {
    return NextResponse.json(
      { error: "faltan los parámetros endpoint, database y profileId" },
      { status: 400 },
    );
  }

  if (onlyTable && !GOLD_TABLES.includes(onlyTable as (typeof GOLD_TABLES)[number])) {
    return NextResponse.json({ error: "tabla desconocida" }, { status: 400 });
  }

  const tablesToSync = onlyTable ? [onlyTable] : GOLD_TABLES;

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
    const entries = await Promise.all(tablesToSync.map(syncTable));
    results = Object.fromEntries(entries);
  } finally {
    await pool.close();
  }

  return NextResponse.json({ ok: true, results });
}
