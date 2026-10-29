// Alta de Agenda para un cliente nuevo, de punta a punta, en un solo paso
// (en vez de crear el calendario a mano en Google Calendar, compartirlo a
// mano con el Service Account, y cargar la fila en Supabase a mano):
//
//   npx tsx scripts/onboard-calendar.ts <clientSlug> "<Nombre del cliente>" email1@moscuagencia.com [email2@... ...]
//
// Qué hace:
// 1. Crea un calendario de Google nuevo, dueño el Service Account.
// 2. Le da rol "writer" a cada email del equipo que se pase — así pueden
//    cargar reuniones ellos mismos desde su propio Google Calendar.
// 3. Carga/actualiza la fila en client_calendars (Supabase).
//
// El Service Account NO necesita que nadie se lo comparta a mano: al
// crear el calendario, ya es su dueño — por eso esto se puede automatizar
// del todo, a diferencia de Drive (ahí el Service Account nunca es dueño
// de una carpeta existente, hay que pedirle a quien sí lo es que
// comparta). Requiere el mismo GOOGLE_SERVICE_ACCOUNT_KEY que ya usan
// Drive/Calendar en el server, con permiso de escritura (no el scope
// calendar.readonly que usa la app en vivo) — por eso este scope más
// amplio vive solo acá, nunca en lib/googleCalendar.ts ni en ninguna ruta
// que corra en el navegador o en Vercel sirviendo tráfico real.

import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleServiceAccount";
import { createAdminClient } from "../lib/supabase/admin";

const KNOWN_CLIENT_SLUGS = ["deca", "adecco"] as const;

function writeCalendarClient() {
  const { client_email, private_key } = googleServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

async function main() {
  const [clientSlug, displayName, ...teamEmails] = process.argv.slice(2);
  if (!clientSlug || !displayName || teamEmails.length === 0) {
    console.error(
      'Uso: npx tsx scripts/onboard-calendar.ts <clientSlug> "<Nombre del cliente>" email1@moscuagencia.com [email2@... ...]',
    );
    process.exit(1);
  }
  if (!(KNOWN_CLIENT_SLUGS as readonly string[]).includes(clientSlug)) {
    console.error(`"${clientSlug}" no es un client_slug conocido (${KNOWN_CLIENT_SLUGS.join(", ")}). Si es un cliente nuevo, agregalo primero a lib/goldTables.ts.`);
    process.exit(1);
  }

  const calendar = writeCalendarClient();

  console.log(`Creando calendario "COOLmetrics · ${displayName}"...`);
  const created = await calendar.calendars.insert({
    requestBody: { summary: `COOLmetrics · ${displayName}`, timeZone: "America/Argentina/Buenos_Aires" },
  });
  const calendarId = created.data.id;
  if (!calendarId) throw new Error("Google no devolvió un ID de calendario.");
  console.log(`Calendario creado: ${calendarId}`);

  for (const email of teamEmails) {
    console.log(`Dando acceso de edición a ${email}...`);
    await calendar.acl.insert({
      calendarId,
      requestBody: { role: "writer", scope: { type: "user", value: email } },
    });
  }

  console.log("Guardando en Supabase (client_calendars)...");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_calendars")
    .upsert({ client_slug: clientSlug, calendar_id: calendarId, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error guardando en Supabase: ${error.message}`);

  console.log("Listo. Agenda ya está conectada para este cliente.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
