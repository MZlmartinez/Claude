import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getClipForRank } from "@/lib/googleInfluencerMedia";

export const dynamic = "force-dynamic";

// Resuelve qué clip le toca a una pieza, por ranking de visualizaciones
// dentro de su propio influencer+campaña (ver lib/googleInfluencerMedia.ts
// para el porqué: no hay forma confiable de atar un archivo a una pieza
// puntual por formato/número). "campana"/"influencer"/"rank" vienen del
// browser, pero nunca escapan del client_slug ya resuelto server-side: como
// mucho, devuelven "no hay carpeta para esa campaña" de tu propio cliente.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");
  const campana = searchParams.get("campana");
  const influencer = searchParams.get("influencer");
  const rank = Number(searchParams.get("rank"));

  if (!campana || !influencer || !Number.isInteger(rank) || rank < 1) {
    return NextResponse.json({ error: "Faltan parámetros (campana, influencer, rank)." }, { status: 400 });
  }
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  try {
    const clip = await getClipForRank(clientSlug, campana, influencer, rank);
    return NextResponse.json({ clip: clip ? { id: clip.id, name: clip.name } : null });
  } catch (error) {
    return NextResponse.json(
      { error: `Error leyendo el material: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
