import { NextResponse } from "next/server";
import { connectFabric } from "@/lib/fabric";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOLD_TABLES } from "@/lib/goldTables";
import { syncGoldTables } from "@/lib/syncGold";

export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const tablesToSync = requestedTables ?? [...GOLD_TABLES];

  const supabase = createAdminClient();
  const pool = await connectFabric(sqlEndpoint, database);

  let results: Record<string, { rows: number; error?: string }>;
  try {
    results = await syncGoldTables(
      pool,
      supabase,
      tablesToSync,
      from && to ? { from, to } : undefined,
    );
  } finally {
    await pool.close();
  }

  return NextResponse.json({ ok: true, results });
}
