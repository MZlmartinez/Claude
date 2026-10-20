// Sync diario de las tablas gold de Fabric a Supabase. Pensado para correr
// en GitHub Actions (ver .github/workflows/sync-gold.yml), no en Vercel —
// acá no hay límite de 60/300 segundos, así que las 16 tablas se
// sincronizan todas juntas, sin partir el trabajo en grupos.
//
// Variables de entorno necesarias (se configuran como Secrets del repo en
// GitHub, no en Vercel): AZURE_TENANT_ID, AZURE_CLIENT_ID,
// AZURE_CLIENT_SECRET, FABRIC_SQL_ENDPOINT, FABRIC_DATABASE,
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { connectFabric } from "../lib/fabric";
import { createAdminClient } from "../lib/supabase/admin";
import { GOLD_TABLES } from "../lib/goldTables";
import { syncGoldTables, type SyncResult } from "../lib/syncGold";

const BIG_TABLES = [
  "gold_shopify_sessions_by_referrer",
  "gold_shopify_sessions_by_referrer_master",
] as const;

const SMALL_TABLES = GOLD_TABLES.filter(
  (t) => !BIG_TABLES.includes(t as (typeof BIG_TABLES)[number]),
);

// Ventana de días hacia atrás para las tablas grandes: suficiente para
// pisar con datos actualizados cualquier sesión que haya llegado tarde,
// sin tener que releer la historia completa cada día.
const LOOKBACK_DAYS = 3;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la env var ${name}`);
  return value;
}

async function main() {
  const sqlEndpoint = requireEnv("FABRIC_SQL_ENDPOINT");
  const database = requireEnv("FABRIC_DATABASE");

  const today = new Date();
  const from = isoDate(new Date(today.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  const to = isoDate(today);

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  let results: Record<string, SyncResult>;
  try {
    const [bigResults, smallResults] = await Promise.all([
      syncGoldTables(pool, supabase, [...BIG_TABLES], { from, to }),
      syncGoldTables(pool, supabase, [...SMALL_TABLES]),
    ]);
    results = { ...bigResults, ...smallResults };
  } finally {
    await pool.close();
  }

  console.log(`Rango para las tablas grandes: ${from} a ${to}`);
  console.table(
    Object.entries(results).map(([table, result]) => ({
      tabla: table,
      filas: result.rows,
      error: result.error ?? "",
    })),
  );

  const failed = Object.entries(results).filter(([, r]) => r.error);
  if (failed.length > 0) {
    console.error(`Fallaron ${failed.length} tabla(s): ${failed.map(([t]) => t).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Error fatal en el sync:", error);
  process.exitCode = 1;
});
