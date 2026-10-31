import { NextResponse } from "next/server";
import { signEmailToken, getClientSlugForEmail } from "@/lib/assistant/clientAuth";

export const dynamic = "force-dynamic";

// TEMPORAL — ver el commit que la borra enseguida después de usarla.
// Vercel no deja volver a ver el valor de ASISTENTE_SIGNING_SECRET una vez
// guardado, así que en vez de copiarlo le pedimos a la propia app (que sí
// lo tiene cargado en runtime) que calcule el token una vez. Email fijo a
// propósito (no recibe parámetro): minimiza qué puede hacer cualquiera que
// la encuentre durante la ventana en que está desplegada.
const EMAIL = "lisandro342@gmail.com";

export async function GET() {
  const token = signEmailToken(EMAIL);
  const client = await getClientSlugForEmail(EMAIL);
  const query = `?u=${encodeURIComponent(EMAIL)}&t=${encodeURIComponent(token)}`;
  return NextResponse.json({ email: EMAIL, client, token, query });
}
