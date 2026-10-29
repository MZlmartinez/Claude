// Muestra, para cada cliente (o uno puntual), qué calendario tiene
// asignado en Agenda y quién tiene acceso a ese calendario. Solo lee, no
// cambia nada.
//
//   npx tsx scripts/list-calendars.ts          (todos los clientes)
//   npx tsx scripts/list-calendars.ts deca     (uno puntual)

import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleServiceAccount";
import { queryReport } from "../lib/supabase/pg";

function calendarClient() {
  const { client_email, private_key } = googleServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    // Scope de escritura (no calendar.readonly): leer la lista de
    // personas con acceso (ACL) necesita más permiso que leer eventos.
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

async function main() {
  const [clientSlugFilter] = process.argv.slice(2);

  const rows = await queryReport<{ client_slug: string; calendar_id: string }>(
    clientSlugFilter
      ? "select client_slug, calendar_id from public.client_calendars where client_slug = $1"
      : "select client_slug, calendar_id from public.client_calendars order by client_slug",
    clientSlugFilter ? [clientSlugFilter] : [],
  );

  if (rows.length === 0) {
    console.log(clientSlugFilter ? `"${clientSlugFilter}" no tiene calendario configurado.` : "Ningún cliente tiene calendario configurado todavía.");
    return;
  }

  const calendar = calendarClient();

  for (const row of rows) {
    console.log(`\n=== ${row.client_slug} ===`);
    console.log(`Calendar ID: ${row.calendar_id}`);

    try {
      const meta = await calendar.calendars.get({ calendarId: row.calendar_id });
      console.log(`Nombre: ${meta.data.summary ?? "(sin nombre)"}`);
    } catch (e) {
      console.log(`No se pudo leer el calendario: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const acl = await calendar.acl.list({ calendarId: row.calendar_id });
    const rules = acl.data.items ?? [];
    console.log("Acceso:");
    for (const rule of rules) {
      const who = rule.scope?.value ?? rule.scope?.type ?? "?";
      console.log(`  - ${who}: ${rule.role}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
