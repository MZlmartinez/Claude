import { NextResponse } from "next/server";
import sql from "mssql";
import { connectFabric } from "@/lib/fabric";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOLD_TABLES } from "@/lib/goldTables";

export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const tablesParam = searchParams.get("table");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!sqlEndpoint || !database) {
    return NextResponse.json(
      { error: "faltan los parámetros endpoint y database" },
      { status: 400 },
    );
  }

  // ?table= acepta una tabla sola o varias separadas por coma, para
  // sincronizar un grupo de una sola llamada (ej. ?table=a,b,c).
  const requestedTables = tablesParam
    ? tablesParam.split(",").map((t) => t.trim())
    : null;

  if (requestedTables) {
    const unknown = requestedTables.filter(
      (t) => !GOLD_TABLES.includes(t as (typeof GOLD_TABLES)[number]),
    );
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `tabla(s) desconocida(s): ${unknown.join(", ")}` },
        { status: 400 },
      );
    }
  }

  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to)) || Boolean(from) !== Boolean(to)) {
    return NextResponse.json(
      { error: "from y to van juntos, en formato YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const tablesToSync = requestedTables ?? GOLD_TABLES;

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  async function syncTable(table: string) {
    try {
      // Una request por tabla, pero todas corren en paralelo sobre el
      // mismo pool (mssql maneja varias conexiones internamente).
      const fabricRequest = pool.request();
      let query = `SELECT * FROM dbo.${table}`;

      // Con from/to filtramos por fecha, para traer el historial de las
      // tablas grandes en pedazos (una corrida por rango) sin pisar lo que
      // ya se cargó de otros rangos.
      if (from && to) {
        fabricRequest.input("fromDate", sql.Date, from);
        fabricRequest.input("toDate", sql.Date, to);
        query += ` WHERE day >= @fromDate AND day < @toDate`;
      }

      const fabricResult = await fabricRequest.query(query);
      const fabricRows = fabricResult.recordset as Record<string, unknown>[];

      // Estas tablas son exclusivas de Decathlon (una tabla por cliente, sin
      // columna de tenant), así que el borrado es de la tabla entera o del
      // rango de fechas pedido, no de un profile_id puntual.
      const deleteBuilder = supabase.from(table).delete().not("id", "is", null);
      if (from && to) {
        await deleteBuilder.gte("day", from).lt("day", to);
      } else {
        await deleteBuilder;
      }

      if (fabricRows.length > 0) {
        const rowsToInsert = fabricRows.map((row) => renameColumns(table, row));

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
