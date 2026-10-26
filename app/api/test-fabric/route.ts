import { NextResponse } from "next/server";
import { queryFabricRaw } from "@/lib/fabric";
import { goldTablesFor, sourceSchema, type ClientSlug } from "@/lib/goldTables";

export const maxDuration = 60;

const CLIENT_SLUGS: ClientSlug[] = ["deca", "adecco"];

// Ruta temporal para probar la conexión real a Fabric desde Vercel (este
// entorno de desarrollo no tiene salida de red a Fabric/Supabase). Protegida
// por un secret simple porque corre en una URL pública.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("key") !== process.env.TEST_ROUTE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sqlEndpoint = searchParams.get("endpoint");
  const database = searchParams.get("database");
  // Default deca para no romper llamadas viejas que no mandan ?client=.
  const client = (searchParams.get("client") ?? "deca") as ClientSlug;

  if (!sqlEndpoint || !database) {
    return NextResponse.json(
      { error: "faltan los parámetros endpoint y database" },
      { status: 400 },
    );
  }

  if (!CLIENT_SLUGS.includes(client)) {
    return NextResponse.json(
      { error: `client desconocido: ${client} (esperaba ${CLIENT_SLUGS.join(" o ")})` },
      { status: 400 },
    );
  }

  // ?counts=1 → cuántas filas tiene cada tabla gold, sin traer los datos.
  if (searchParams.get("counts")) {
    try {
      const unionQuery = goldTablesFor(client)
        .map((t) => `SELECT '${t}' AS tbl, COUNT(*) AS total FROM ${sourceSchema(client, t)}.${t}`)
        .join(" UNION ALL ");
      const counts = await queryFabricRaw(sqlEndpoint, database, unionQuery);
      return NextResponse.json({ ok: true, counts });
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  // ?daterange=1 → rango de fechas (MIN/MAX day) de las tablas grandes,
  // para planificar en cuántos pedazos conviene backfillear el historial.
  if (searchParams.get("daterange")) {
    try {
      const bigTables = [
        "gold_shopify_sessions_by_referrer_master",
        "gold_shopify_sessions_by_referrer",
        "gold_shopify_customer_behavior",
      ];
      const unionQuery = bigTables
        .map((t) => `SELECT '${t}' AS tbl, MIN(day) AS min_day, MAX(day) AS max_day FROM dbo.${t}`)
        .join(" UNION ALL ");
      const ranges = await queryFabricRaw(sqlEndpoint, database, unionQuery);
      return NextResponse.json({ ok: true, ranges });
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  const table = searchParams.get("table") ?? "gold_shopify_channel";

  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    return NextResponse.json({ error: "nombre de tabla inválido" }, { status: 400 });
  }

  try {
    const rows = await queryFabricRaw(
      sqlEndpoint,
      database,
      `SELECT TOP 5 * FROM ${sourceSchema(client, table)}.${table}`,
    );
    return NextResponse.json({ ok: true, table, rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
