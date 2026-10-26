import { NextResponse } from "next/server";
import { runAssistantQuery } from "@/lib/supabase/readonlyPg";

export const dynamic = "force-dynamic";

// Vuelve a correr el SQL de un reporte guardado para traer números frescos
// (los datos cambian todos los días con el sync). Mismo runAssistantQuery
// que usa el chat en vivo — mismas validaciones de solo lectura, no es más
// riesgoso re-ejecutar un SQL guardado que ejecutarlo la primera vez.
export async function POST(request: Request) {
  if (!process.env.SUPABASE_READONLY_DB_URL) {
    return NextResponse.json({ error: "Falta configurar la variable de entorno SUPABASE_READONLY_DB_URL." }, { status: 500 });
  }

  let body: { sql?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const sql = (body.sql ?? "").trim();
  if (!sql) {
    return NextResponse.json({ error: "Falta el SQL a ejecutar." }, { status: 400 });
  }

  // Mismo supuesto que el chat en vivo: hoy el único cliente con pool de
  // solo lectura es Decathlon ("deca") — ver lib/supabase/readonlyPg.ts.
  const result = await runAssistantQuery(sql, "deca");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ rows: result.rows });
}
