import { NextResponse } from "next/server";
import { connectFabric } from "@/lib/fabric";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOLD_TABLES } from "@/lib/goldTables";
import { syncGoldTables } from "@/lib/syncGold";

export const maxDuration = 60;

// Las únicas 2 tablas gold que tienen columna `day` y son demasiado grandes
// para traer enteras en cada corrida; el resto se sincroniza siempre entera
// (son chicas, entran cómodas en una sola llamada).
const BIG_TABLES = [
  "gold_shopify_sessions_by_referrer",
  "gold_shopify_sessions_by_referrer_master",
] as const;

const SMALL_TABLES = GOLD_TABLES.filter(
  (t) => !BIG_TABLES.includes(t as (typeof BIG_TABLES)[number]),
);

// Una sola corrida con las 16 tablas se pasaba de los 60s que permite una
// función en el plan Hobby de Vercel. Se parte en grupos más chicos, cada
// uno con su propio Cron Job (ver vercel.json) escalonado cada 5 minutos,
// para que cada invocación tenga su propia ventana de 60s entera.
const BIG_RANGE_GROUPS = new Set(["big1", "big2"]);

const GROUPS: Record<string, readonly string[]> = {
  big1: [BIG_TABLES[0]],
  big2: [BIG_TABLES[1]],
  a: SMALL_TABLES.slice(0, 5),
  b: SMALL_TABLES.slice(5, 10),
  // gold_influencers aislada en su propio grupo — es la que alimenta el
  // reporte de /reportes/influencers, así que no debe compartir Promise.all
  // con ninguna otra tabla que pueda tardar y arrastrarla a un timeout.
  influencers: ["gold_influencers"],
  c: SMALL_TABLES.filter((t) => t !== "gold_influencers").slice(10),
};

// Ventana de días hacia atrás para las tablas grandes: suficiente para
// pisar con datos actualizados cualquier sesión que haya llegado tarde,
// sin tener que releer la historia completa cada día.
const LOOKBACK_DAYS = 3;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Este endpoint lo llama exclusivamente el Cron Job de Vercel (ver
// vercel.json), autenticado con el header estándar que Vercel agrega solo
// cuando existe la env var CRON_SECRET — no acepta la clave de las rutas
// de prueba/manuales. El parámetro ?group= decide qué subconjunto de
// tablas sincroniza esta invocación puntual (ver GROUPS arriba).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group");
  const tables = group ? GROUPS[group] : undefined;

  if (!tables) {
    return NextResponse.json(
      { error: `?group= inválido o faltante. Opciones: ${Object.keys(GROUPS).join(", ")}` },
      { status: 400 },
    );
  }

  const sqlEndpoint = process.env.FABRIC_SQL_ENDPOINT;
  const database = process.env.FABRIC_DATABASE;

  if (!sqlEndpoint || !database) {
    return NextResponse.json(
      { error: "faltan las env vars FABRIC_SQL_ENDPOINT y FABRIC_DATABASE" },
      { status: 500 },
    );
  }

  const today = new Date();
  const from = isoDate(new Date(today.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  const to = isoDate(today);

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  let results: Record<string, { rows: number; error?: string }>;
  try {
    results = await syncGoldTables(
      pool,
      supabase,
      [...tables],
      group && BIG_RANGE_GROUPS.has(group) ? { from, to } : undefined,
    );
  } finally {
    await pool.close();
  }

  return NextResponse.json({
    ok: true,
    group,
    range: group && BIG_RANGE_GROUPS.has(group) ? { from, to } : undefined,
    results,
  });
}
