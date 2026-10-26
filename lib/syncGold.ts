import sql from "mssql";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sourceSchema, sourceSelectColumns, type ClientSlug } from "@/lib/goldTables";

// Columnas que renombramos al pasar de Fabric a Supabase: por mayúsculas
// mixtas (UltimoPeriodo) o por caracteres con tilde/ñ, para evitar líos de
// encoding en nombres de columna de Postgres.
const COLUMN_RENAMES: Record<string, Record<string, string>> = {
  gold_shopify_time: { UltimoPeriodo: "ultimo_periodo" },
  gold_influencers: {
    "campaña": "campana",
    "presupuesto_año_fiscal": "presupuesto_anio_fiscal",
  },
  gold_prensa: {
    "campaña": "campana",
    "mención_gestión": "mencion_gestion",
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

// Un solo INSERT con demasiadas filas puede pasarse del statement_timeout
// de Postgres (ya nos pasó con gold_shopify_customer_behavior). Se manda
// en lotes de este tamaño en vez de todo junto.
const INSERT_BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
  client: ClientSlug,
  table: string,
  range?: { from: string; to: string },
): Promise<SyncResult> {
  try {
    const cutoff = new Date().toISOString();

    const fabricRequest = pool.request();
    const columns = sourceSelectColumns(client, table);
    const select = columns ? columns.map((c) => `[${c}]`).join(", ") : "*";
    let query = `SELECT ${select} FROM ${sourceSchema(client, table)}.${table}`;

    if (range) {
      fabricRequest.input("fromDate", sql.Date, range.from);
      fabricRequest.input("toDate", sql.Date, range.to);
      query += ` WHERE day >= @fromDate AND day < @toDate`;
    }

    const fabricResult = await fabricRequest.query(query);
    const fabricRows = fabricResult.recordset as Record<string, unknown>[];

    if (fabricRows.length > 0) {
      const rowsToInsert = fabricRows.map((row) => renameColumns(table, row));
      for (const batch of chunk(rowsToInsert, INSERT_BATCH_SIZE)) {
        const { error } = await supabase.from(table).insert(batch);
        if (error) throw new Error(error.message);
      }
    }

    // Cada tabla gold es exclusiva de un cliente (sin columna de tenant),
    // así que el borrado es de la tabla entera o del rango de fechas
    // pedido, no de un profile_id puntual. El filtro por synced_at < cutoff
    // deja afuera lo que acabamos de insertar.
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
  client: ClientSlug,
  tables: string[],
  range?: { from: string; to: string },
): Promise<Record<string, SyncResult>> {
  const entries = await Promise.all(
    tables.map(
      async (table) => [table, await syncGoldTable(pool, supabase, client, table, range)] as const,
    ),
  );
  return Object.fromEntries(entries);
}
