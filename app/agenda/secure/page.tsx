import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import { getCalendarIdForClient, listPastEvents, listUpcomingEvents } from "@/lib/googleCalendar";
import type { ClientSlug } from "@/lib/goldTables";
import AgendaDashboard from "./AgendaDashboard";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// Mismo esquema que /documentos/secure: candado de identidad server-side
// antes de mostrar nada. A diferencia de Documentos (necesita navegación
// interactiva de subcarpetas), acá no hace falta ningún fetch del lado
// del cliente — se resuelve todo acá, como Growth/Influencers.
const ALLOWED_CLIENTS: ClientSlug[] = ["deca", "adecco"];

export default async function SecureAgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const email = one(params.u);
  const token = one(params.t);

  if (!email || !verifyEmailToken(email, token)) {
    return <Unauthorized reason="No se pudo verificar el usuario." />;
  }
  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug || !ALLOWED_CLIENTS.includes(clientSlug as ClientSlug)) {
    return <Unauthorized reason="Este reporte no está disponible para tu cuenta." />;
  }

  const calendarId = await getCalendarIdForClient(clientSlug);
  let upcoming: Awaited<ReturnType<typeof listUpcomingEvents>> = [];
  let past: Awaited<ReturnType<typeof listPastEvents>> = [];
  let error: string | null = null;
  if (calendarId) {
    try {
      [upcoming, past] = await Promise.all([listUpcomingEvents(calendarId), listPastEvents(calendarId)]);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <AgendaDashboard
      fontClassName={`${mxDisplay.variable} ${mxBody.variable}`}
      upcoming={upcoming}
      past={past}
      calendarConfigured={!!calendarId}
      error={error}
    />
  );
}

// Fondo y color propios, no heredados — mismo motivo que en
// /documentos/secure y /reportes/growth/secure.
function Unauthorized({ reason }: { reason: string }) {
  return (
    <div
      style={{
        padding: 40,
        fontFamily: "sans-serif",
        color: "#1d1d1b",
        background: "#ffffff",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <p>{reason}</p>
    </div>
  );
}
