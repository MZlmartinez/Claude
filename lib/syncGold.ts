import sql from "mssql";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sourceSchema } from "@/lib/goldTables";

// Columnas que renombramos al pasar de Fabric a Supabase: por mayúsculas
// mixtas (UltimoPeriodo) o por caracteres con tilde/ñ, para evitar líos de
// encoding en nombres de columna de Postgres.
const COLUMN_RENAMES: Record<string, Record<string, string>> = {
  gold_shopify_time: { UltimoPeriodo: "ultimo_periodo" },
  gold_influencers: {
    "campaña": "campana",
    "presupuesto_año_fiscal": "presupuesto_anio_fiscal",
  },
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

export type SyncResult = { rows: number; error?: string };

// Sincroniza una tabla gold de Fabric a Supabase: inserta primero lo nuevo
// que trae Fabric, y recién si esa inserción salió bien borra lo viejo (todo,
// o solo el rango from/to si se pasa) usando `synced_at` como corte — nunca
// al revés. Si algo se corta a la mitad (timeout, error de red), el peor
// caso son filas duplicadas por un rato, nunca una tabla vacía: la
// inserción previa queda intacta porque todavía no se tocó nada viejo.
// `from`/`to` requieren que la tabla tenga columna `day` (las 2 tablas
// grandes de sesiones la tienen; el resto se sincroniza siempre entera).
export async function syncGoldTable(
  pool: sql.ConnectionPool,
  supabase: SupabaseClient,
  table: string,
  range?: { from: string; to: string },
): Promise<SyncResult> {
  try {
    const cutoff = new Date().toISOString();

    const fabricRequest = pool.request();
    let query = `SELECT * FROM ${sourceSchema(table)}.${table}`;

    if (range) {
      fabricRequest.input("fromDate", sql.Date, range.from);
      fabricRequest.input("toDate", sql.Date, range.to);
      query += ` WHERE day >= @fromDate AND day < @toDate`;
    }

    const fabricResult = await fabricRequest.query(query);
    const fabricRows = fabricResult.recordset as Record<string, unknown>[];

    if (fabricRows.length > 0) {
      const rowsToInsert = fabricRows.map((row) => renameColumns(table, row));
      const { error } = await supabase.from(table).insert(rowsToInsert);
      if (error) throw new Error(error.message);
    }

    // Estas tablas son exclusivas de Decathlon (una tabla por cliente, sin
    // columna de tenant), así que el borrado es de la tabla entera o del
    // rango de fechas pedido, no de un profile_id puntual. El filtro por
    // synced_at < cutoff deja afuera lo que acabamos de insertar.
    const deleteBuilder = supabase.from(table).delete().lt("synced_at", cutoff);
    if (range) {
      await deleteBuilder.gte("day", range.from).lt("day", range.to);
    } else {
      await deleteBuilder;
    }

    return { rows: fabricRows.length };
  } catch (error) {
    return { rows: 0, error: String(error) };
  }
}

export async function syncGoldTables(
  pool: sql.ConnectionPool,
  supabase: SupabaseClient,
  tables: string[],
  range?: { from: string; to: string },
): Promise<Record<string, SyncResult>> {
  const entries = await Promise.all(
    tables.map(async (table) => [table, await syncGoldTable(pool, supabase, table, range)] as const),
  );
  return Object.fromEntries(entries);
}
