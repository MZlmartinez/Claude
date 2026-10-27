import { NextResponse } from "next/server";
import { runAssistantQuery } from "@/lib/supabase/readonlyPg";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import type { ClientSlug } from "@/lib/goldTables";

export const dynamic = "force-dynamic";

const ALLOWED_CLIENTS: ClientSlug[] = ["deca", "adecco"];

// Vuelve a correr el SQL de un reporte guardado para traer números frescos
// (los datos cambian todos los días con el sync). Mismo runAssistantQuery
// que usa el chat en vivo — mismas validaciones de solo lectura, no es más
// riesgoso re-ejecutar un SQL guardado que ejecutarlo la primera vez.
//
// Requiere email+token igual que el chat: sin eso no hay forma de saber
// de qué cliente es el SQL guardado, y correrlo contra el pool equivocado
// filtraría datos de otro cliente (o fallaría con el allowlist, en el
// mejor caso).
export async function POST(request: Request) {
  let body: { sql?: string; email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const sql = (body.sql ?? "").trim();
  if (!sql) {
    return NextResponse.json({ error: "Falta el SQL a ejecutar." }, { status: 400 });
  }

  if (!body.email || !verifyEmailToken(body.email, body.token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }
  const clientSlug = await getClientSlugForEmail(body.email);
  if (!clientSlug || !ALLOWED_CLIENTS.includes(clientSlug as ClientSlug)) {
    return NextResponse.json(
      { error: "El asistente de IA todavía no está habilitado para este cliente." },
      { status: 501 },
    );
  }

  const result = await runAssistantQuery(sql, clientSlug as ClientSlug);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ rows: result.rows });
}
