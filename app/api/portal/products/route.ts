import { NextResponse } from "next/server";
import { getActiveProducts, getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";

export const dynamic = "force-dynamic";

// Mismo motivo que /api/agenda/list: el script compartido de Softr llama a
// este endpoint con fetch() directo desde coolmetrics.moscuagencia.com —
// sin este header, el navegador descarta la respuesta en silencio.
function json(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

// Qué secciones del portal (growth, influencers, prensa, performance,
// cashflow) tiene contratadas el cliente del usuario logueado — una sola
// llamada que reemplaza los campos PBI_* por usuario en Softr (ver
// client_products / lib/assistant/clientAuth.ts getActiveProducts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");

  if (!email || !verifyEmailToken(email, token)) {
    return json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  const productos = await getActiveProducts(clientSlug);
  return json({ cliente: clientSlug, productos });
}
