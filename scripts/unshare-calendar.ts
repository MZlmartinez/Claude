// Saca el acceso de alguien a un calendario de Agenda que ya existe —
// contraparte de scripts/share-calendar.ts.
//
//   npx tsx scripts/unshare-calendar.ts <clientSlug> email1@moscuagencia.com [email2@... ...]

import { google } from "googleapis";
import { googleServiceAccountCredentials } from "../lib/googleServiceAccount";
import { queryReport } from "../lib/supabase/pg";

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
  const [clientSlug, ...teamEmails] = process.argv.slice(2);
  if (!clientSlug || teamEmails.length === 0) {
    console.error("Uso: npx tsx scripts/unshare-calendar.ts <clientSlug> email1@moscuagencia.com [email2@... ...]");
    process.exit(1);
  }

  const rows = await queryReport<{ calendar_id: string }>(
    "select calendar_id from public.client_calendars where client_slug = $1",
    [clientSlug],
  );
  const calendarId = rows[0]?.calendar_id;
  if (!calendarId) {
    console.error(`No hay calendario cargado para "${clientSlug}" en client_calendars.`);
    process.exit(1);
  }

  const calendar = writeCalendarClient();
  for (const email of teamEmails) {
    console.log(`Sacando el acceso de ${email}...`);
    // El id de la regla de ACL para un scope "user" es siempre
    // "user:<email>" — no hace falta listar las reglas para encontrarlo.
    await calendar.acl.delete({ calendarId, ruleId: `user:${email}` });
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
