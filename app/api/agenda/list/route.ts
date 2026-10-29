import { NextResponse } from "next/server";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getCalendarIdForClient, listUpcomingEvents } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

// Mismo motivo que /api/documentos/list: el bloque de Home en Softr llama
// a este endpoint con fetch() directo desde coolmetrics.moscuagencia.com —
// sin este header, el navegador descarta la respuesta en silencio.
function json(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

// Mismo candado de identidad que el resto: el client_slug (y por lo tanto
// el calendario que se lee) se resuelve siempre acá, server-side, nunca a
// partir de un parámetro enviado por el browser.
export async function GET(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return json({ error: "Falta configurar GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 500 });
  }

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

  const calendarId = await getCalendarIdForClient(clientSlug);
  if (!calendarId) {
    return json({ events: [] });
  }

  try {
    const events = await listUpcomingEvents(calendarId);
    return json({ events });
  } catch (error) {
    return json(
      { error: `Error leyendo Google Calendar: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
