// Credenciales del Service Account compartido (Drive y Calendar) — sin
// login humano ni OAuth: el server se autentica con su propia identidad
// fija, y solo puede ver lo que se compartió a mano con ese email. Un
// solo Service Account para todo (no uno por cliente): ver la charla en
// la sesión sobre por qué, acá el "folder/calendar está dentro del árbol
// del cliente" siempre se valida server-side, nunca se confía en lo que
// mande el browser.
export function googleServiceAccountCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Falta la env var GOOGLE_SERVICE_ACCOUNT_KEY");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY no tiene el formato esperado (falta client_email o private_key).");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}
