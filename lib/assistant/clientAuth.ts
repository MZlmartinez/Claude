import { createHmac, timingSafeEqual } from "crypto";
import { queryReport } from "@/lib/supabase/pg";

// Firma del email que identifica al usuario logueado en Softr. El email en
// sí llega como query param (ver app/asistente/page.tsx) — editable por
// cualquiera, así que no alcanza como identidad: hace falta un token que
// solo nosotros podamos generar, para que el backend sepa que ese email
// realmente vino de la fila correspondiente en Softr y no fue tipeado a
// mano. El token se precalcula acá (no en Softr, que no puede hacer HMAC) y
// se pega como campo estático en la tabla de Softr, igual que los campos
// PBI_* que ya existen hoy — Softr solo lo lee y lo reenvía.
function secret(): string {
  const value = process.env.ASISTENTE_SIGNING_SECRET;
  if (!value) throw new Error("Falta la env var ASISTENTE_SIGNING_SECRET");
  return value;
}

export function signEmailToken(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex");
}

export function verifyEmailToken(email: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(signEmailToken(email), "hex");
  const given = Buffer.from(token, "hex");
  // Buffer.from con hex inválido no tira error, devuelve menos bytes —
  // timingSafeEqual sí tira si los tamaños no coinciden, así que lo
  // chequeamos antes en vez de dejar que explote.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

// client_users es una tabla operativa de la app (no viene de Fabric), vive
// en la misma base que las gold_* — se lee con el pool con privilegios de
// escritura (lib/supabase/pg.ts) porque es el único que ya existe server-side
// para esto; igual que esa tabla, nunca se expone al browser.
export async function getClientSlugForEmail(email: string): Promise<string | null> {
  const rows = await queryReport<{ client_slug: string }>(
    "select client_slug from public.client_users where email = $1",
    [email.trim().toLowerCase()],
  );
  return rows[0]?.client_slug ?? null;
}
