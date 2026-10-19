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
// de prueba/manuales.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const smallTables = GOLD_TABLES.filter(
    (t) => !BIG_TABLES.includes(t as (typeof BIG_TABLES)[number]),
  );

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  let results: Record<string, { rows: number; error?: string }>;
  try {
    const [bigResults, smallResults] = await Promise.all([
      syncGoldTables(pool, supabase, [...BIG_TABLES], { from, to }),
      syncGoldTables(pool, supabase, smallTables),
    ]);
    results = { ...bigResults, ...smallResults };
  } finally {
    await pool.close();
  }

  return NextResponse.json({ ok: true, range: { from, to }, results });
}
