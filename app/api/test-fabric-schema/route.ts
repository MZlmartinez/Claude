import { NextResponse } from "next/server";
import { queryFabricRaw } from "@/lib/fabric";

// Ruta temporal: trae la estructura (columnas + tipos) de todas las tablas
// "gold_*" de un workspace de Fabric, para poder generar las tablas
// espejo en Supabase con los tipos correctos.
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

  try {
    const columns = await queryFabricRaw(
      sqlEndpoint,
      database,
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE,
              CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'gold_%'
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    );
    return NextResponse.json({ ok: true, columns });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
