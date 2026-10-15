import { NextResponse } from "next/server";
import { queryFabricRaw } from "@/lib/fabric";
import { GOLD_TABLES } from "@/lib/goldTables";

export const maxDuration = 60;

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

  if (!sqlEndpoint || !database) {
    return NextResponse.json(
      { error: "faltan los parámetros endpoint y database" },
      { status: 400 },
    );
  }

  // ?counts=1 → cuántas filas tiene cada tabla gold, sin traer los datos.
  if (searchParams.get("counts")) {
    try {
      const unionQuery = GOLD_TABLES.map(
        (t) => `SELECT '${t}' AS tbl, COUNT(*) AS total FROM dbo.${t}`,
      ).join(" UNION ALL ");
      const counts = await queryFabricRaw(sqlEndpoint, database, unionQuery);
      return NextResponse.json({ ok: true, counts });
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
      `SELECT TOP 5 * FROM dbo.${table}`,
    );
    return NextResponse.json({ ok: true, table, rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
