// Sync diario de las tablas gold de Fabric a Supabase. Pensado para correr
// en GitHub Actions (ver .github/workflows/sync-gold.yml), no en Vercel —
// acá no hay límite de 60/300 segundos, así que las tablas de cada cliente
// se sincronizan todas juntas, sin partir el trabajo en grupos.
//
// Variables de entorno necesarias (se configuran como Secrets del repo en
// GitHub, no en Vercel — son dos almacenes separados, hay que cargarlas en
// los dos lados): AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
// AZURE_SUBSCRIPTION_ID, AZURE_FABRIC_RESOURCE_GROUP,
// AZURE_FABRIC_CAPACITY_NAME, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL (esta última la usa
// refreshGrowthRollups() al final, conexión directa a Postgres — no alcanza
// con la API REST).
//
// Por cliente, el connection string de su Lakehouse en Fabric:
// - Decathlon (deca): FABRIC_SQL_ENDPOINT, FABRIC_DATABASE (nombres
//   históricos, sin sufijo — es el único cliente que syncea hoy).
// - Adecco: FABRIC_SQL_ENDPOINT_ADECCO, FABRIC_DATABASE_ADECCO. Mientras
//   no existan estos dos secrets, el sync salta a Adecco sin fallar — se
//   suma solo apenas se configuren, sin tocar este archivo de nuevo.

import { connectFabric } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";
import { createAdminClient } from "../lib/supabase/admin";
import { goldTablesFor, type ClientSlug } from "../lib/goldTables";
import { syncGoldTables, type SyncResult } from "../lib/syncGold";
import { refreshGrowthRollups } from "../lib/reports/growth";

// Tablas con columna `day`, que sincronizamos en una ventana de los
// últimos LOOKBACK_DAYS en vez de la historia completa (suficiente para
// pisar con datos actualizados cualquier sesión que haya llegado tarde,
// sin releer todo cada día). Hoy solo las tiene Decathlon.
const BIG_TABLES_BY_CLIENT: Partial<Record<ClientSlug, readonly string[]>> = {
  deca: ["gold_shopify_sessions_by_referrer_master"],
};

const LOOKBACK_DAYS = 3;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type ClientFabricConfig = { slug: ClientSlug; sqlEndpoint?: string; database?: string };

function clientConfigs(): ClientFabricConfig[] {
  return [
    { slug: "deca", sqlEndpoint: process.env.FABRIC_SQL_ENDPOINT, database: process.env.FABRIC_DATABASE },
    {
      slug: "adecco",
      sqlEndpoint: process.env.FABRIC_SQL_ENDPOINT_ADECCO,
      database: process.env.FABRIC_DATABASE_ADECCO,
    },
  ];
}

async function syncClient(
  config: ClientFabricConfig,
  supabase: ReturnType<typeof createAdminClient>,
  from: string,
  to: string,
): Promise<Record<string, SyncResult>> {
  if (!config.sqlEndpoint || !config.database) {
    console.log(
      `Salteando ${config.slug}: todavía no tiene connection string de Fabric configurado.`,
    );
    return {};
  }

  const allTables = goldTablesFor(config.slug);
  const bigTables = BIG_TABLES_BY_CLIENT[config.slug] ?? [];
  const smallTables = allTables.filter((t) => !bigTables.includes(t));

  const pool = await connectFabric(config.sqlEndpoint, config.database);
  try {
    const [bigResults, smallResults] = await Promise.all([
      bigTables.length
        ? syncGoldTables(pool, supabase, config.slug, [...bigTables], { from, to })
        : Promise.resolve({}),
      syncGoldTables(pool, supabase, config.slug, [...smallTables]),
    ]);
    return { ...bigResults, ...smallResults };
  } finally {
    await pool.close();
  }
}

async function main() {
  const today = new Date();
  const from = isoDate(new Date(today.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  const to = isoDate(today);

  await ensureFabricCapacityActive();

  const supabase = createAdminClient();

  let results: Record<string, SyncResult> = {};
  try {
    for (const config of clientConfigs()) {
      const clientResults = await syncClient(config, supabase, from, to);
      results = { ...results, ...clientResults };
    }
  } finally {
    await pauseFabricCapacity();
  }

  // Los rollups diarios que usa /reportes/growth (ver lib/reports/growth.ts)
  // se recalculan acá, una sola vez por día, después de sincronizar — así
  // el dashboard lee una tabla ya agregada en vez de escanear las tablas
  // crudas de sesiones/ventas (880k+ filas) en cada visita. No depende de
  // Fabric, así que corre después de pausar la capacidad, sin extender el
  // tiempo que queda despierta.
  await refreshGrowthRollups();

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
