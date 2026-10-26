import type { ClientSlug } from "@/lib/goldTables";

// Cada cliente puede tener su propia cuenta/API key de Anthropic, para que
// el costo y la facturación de IA de cada uno queden separados (no es un
// tema de acceso a datos — eso ya lo resuelve runAssistantQuery con el
// pool y el allowlist por cliente). Decathlon usa el nombre histórico sin
// sufijo, para no tener que recrear el secret en Vercel; los clientes
// nuevos se agregan con su propio sufijo, mismo patrón que
// FABRIC_SQL_ENDPOINT_ADECCO en scripts/sync-gold.ts.
export function anthropicApiKeyFor(client: ClientSlug): string | undefined {
  if (client === "deca") return process.env.ANTHROPIC_API_KEY;
  return process.env[`ANTHROPIC_API_KEY_${client.toUpperCase()}`];
}
