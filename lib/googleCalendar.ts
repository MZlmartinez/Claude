import { google } from "googleapis";
import { queryReport } from "@/lib/supabase/pg";
import { googleServiceAccountCredentials } from "@/lib/googleServiceAccount";

// Mismo Service Account que Drive (ver lib/googleServiceAccount.ts) —
// solo lectura, y solo puede ver los calendarios que se compartieron a
// mano con esa cuenta. Un calendario dedicado por cliente (no uno
// compartido con etiquetas por evento): mismo criterio que una carpeta
// de Drive por cliente — la separación la garantiza Google al compartir,
// no una lógica de clasificación en código.
function calendarClient() {
  const { client_email, private_key } = googleServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  return google.calendar({ version: "v3", auth });
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string | null; // ISO
  end: string | null; // ISO
  meetLink: string | null;
  location: string | null;
};

// client_calendars: una fila por cliente (no por usuario), mismo patrón
// que client_drive_folders — ver supabase/schema_client_calendars.sql.
export async function getCalendarIdForClient(clientSlug: string): Promise<string | null> {
  const rows = await queryReport<{ calendar_id: string }>(
    "select calendar_id from public.client_calendars where client_slug = $1",
    [clientSlug],
  );
  return rows[0]?.calendar_id ?? null;
}

function toEvent(e: {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  hangoutLink?: string | null;
  location?: string | null;
}): CalendarEvent {
  return {
    id: e.id ?? "",
    title: e.summary ?? "Sin título",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    meetLink: e.hangoutLink ?? null,
    location: e.location ?? null,
  };
}

// Próximos eventos desde ahora — "upcoming", ordenados por inicio.
export async function listUpcomingEvents(calendarId: string, maxResults = 10): Promise<CalendarEvent[]> {
  const calendar = calendarClient();
  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map(toEvent);
}

// Eventos pasados — "anteriores", los más recientes primero. La API de
// Calendar no soporta orden descendente directo con singleEvents, así
// que se pide ascendente dentro de una ventana acotada (últimos 90 días)
// y se toma la cola (los más cercanos a hoy), invertida para mostrar.
export async function listPastEvents(calendarId: string, maxResults = 10): Promise<CalendarEvent[]> {
  const calendar = calendarClient();
  const now = new Date();
  const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90);
  const res = await calendar.events.list({
    calendarId,
    timeMin: since.toISOString(),
    timeMax: now.toISOString(),
    maxResults: 250,
    singleEvents: true,
    orderBy: "startTime",
  });
  const items = (res.data.items ?? []).map(toEvent);
  return items.slice(-maxResults).reverse();
}
