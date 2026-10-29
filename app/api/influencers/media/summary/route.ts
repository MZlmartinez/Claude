import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getInfluencerMediaSummary } from "@/lib/googleInfluencerMedia";

export const dynamic = "force-dynamic";

// Para la columna "Contenido" de la tabla Influencers: cuántas piezas vs.
// cuántos clips reales hay para ese influencer, sumando todas sus
// campañas. "influencer" viene del browser, pero la consulta queda
// siempre acotada a la tabla del client_slug ya resuelto server-side.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("u");
  const token = searchParams.get("t");
  const influencer = searchParams.get("influencer");

  if (!influencer) {
    return NextResponse.json({ error: "Falta el influencer." }, { status: 400 });
  }
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 401 });
  }

  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug) {
    return NextResponse.json({ error: "Este usuario no está habilitado." }, { status: 403 });
  }

  try {
    const summary = await getInfluencerMediaSummary(clientSlug, influencer);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: `Error leyendo el material: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
