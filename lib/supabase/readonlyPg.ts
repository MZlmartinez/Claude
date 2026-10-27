import { Pool } from "pg";
import { goldTablesFor, type ClientSlug } from "@/lib/goldTables";

// Conexión de solo lectura para el asistente de IA (app/api/asistente):
// un rol de Postgres aparte (decathlon_readonly), sin permisos de
// escritura y con GRANT SELECT únicamente sobre las tablas gold_* — nunca
// el mismo pool que usan los reportes (lib/supabase/pg.ts), que corre con
// un rol que sí puede escribir. Server-only.
let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_READONLY_DB_URL,
      ssl: { rejectUnauthorized: false },
      // decathlon_readonly tiene CONNECTION LIMIT 3 en Postgres — ese límite
      // es GLOBAL al rol, no por instancia de esta función. En Vercel cada
      // ruta (chat, rerun) es una función serverless aparte, y cada una
      // puede tener su propia instancia "congelada" entre invocaciones sin
      // soltar su conexión prolijamente. Con max:2 en cada una, alcanza con
      // dos rutas activas a la vez para llenar el límite y dejarlo trabado
      // (nos pasó: 3 conexiones quietas, la más vieja de 6 minutos). max:1
      // + un idle timeout corto reduce cuánto tarda cada instancia en
      // soltar la conexión sola si queda colgada.
      max: 1,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

// Pools por cliente, para cualquiera que no sea Decathlon: cada cliente
// nuevo tiene su propio rol de Postgres de solo lectura (mismo patrón que
// decathlon_readonly), así que necesita su propio Pool y su propia env
// var de connection string.
const clientPools = new Map<string, Pool>();

function clientDbUrlEnvVar(slug: string): string {
  return `SUPABASE_READONLY_DB_URL_${slug.toUpperCase()}`;
}

export function getClientPool(slug: string): Pool {
  let clientPool = clientPools.get(slug);
  if (!clientPool) {
    const envVar = clientDbUrlEnvVar(slug);
    const connectionString = process.env[envVar];
    if (!connectionString) throw new Error(`Falta la env var ${envVar}`);
    clientPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    });
    clientPools.set(slug, clientPool);
  }
  return clientPool;
}

export type AssistantQueryResult = { rows: Record<string, unknown>[] } | { error: string };

const MAX_ROWS = 500;

// Primera palabra no vacía del SQL (ignorando comentarios de línea/bloque
// y espacios), para chequear que la consulta solo lee.
function firstKeyword(sql: string): string {
  const stripped = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  const match = stripped.match(/^[a-zA-Z]+/);
  return (match?.[0] ?? "").toLowerCase();
}

// Cuenta los ';' que no sean el único de cierre final, para bloquear
// sentencias encadenadas (ej. "select 1; delete from x").
function hasChainedStatements(sql: string): boolean {
  const stripped = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .replace(/;+\s*$/, ""); // saca un único ';' final si lo hay
  return stripped.includes(";");
}

// Nombres que aparecen después de FROM/JOIN, en minúscula y sin comillas
// ni prefijo de schema (ej. "public.gold_x" o "[gold_x]" → "gold_x"). No
// es un parser de SQL completo — alcanza para el tipo de consultas de
// solo lectura que arma el asistente, y es una capa extra, no la única:
// el GRANT real de Postgres es el límite de fondo si esto tiene algún
// punto ciego. Punto ciego conocido: no detecta el estilo viejo
// "FROM a, b" (join implícito por coma) — ningún caso real lo usa hoy, y
// si alguna vez pasara igual lo frena el GRANT.
function referencedTables(sql: string): string[] {
  const matches = sql.matchAll(/\b(?:from|join)\s+"?(?:\w+"?\.)?"?(\w+)"?/gi);
  return [...matches].map((m) => m[1].toLowerCase());
}

// Nombres definidos con WITH ... AS (...) — hay que excluirlos del chequeo
// de tablas permitidas, si no cualquier CTE legítima ("with recientes as
// (...) select * from recientes") se rechazaría como si fuera una tabla
// desconocida.
function definedCteNames(sql: string): string[] {
  const matches = sql.matchAll(/\b(?:with|,)\s+"?(\w+)"?\s+as\s*\(/gi);
  return [...matches].map((m) => m[1].toLowerCase());
}

// Devuelve el primer nombre de tabla que NO está en la lista permitida
// para ese cliente, o null si está todo bien. Capa de defensa en código,
// antes incluso de que la consulta llegue a Postgres — ver el comentario
// de runAssistantQuery.
function findDisallowedTable(sql: string, allowedTables: readonly string[]): string | null {
  const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const allowed = new Set([
    ...allowedTables.map((t) => t.toLowerCase()),
    ...definedCteNames(stripped),
  ]);
  for (const table of referencedTables(stripped)) {
    if (!allowed.has(table)) return table;
  }
  return null;
}

// Defensa en profundidad además de los permisos ya puestos en la base
// (decathlon_readonly solo tiene SELECT sobre las tablas gold_* de
// Decathlon, no sobre las de otros clientes): esto evita que una consulta
// mal armada por el modelo encadene sentencias, intente algo que no sea
// una lectura, o mencione una tabla fuera de la lista documentada de este
// cliente — todo antes de que Postgres la vea.
export async function runAssistantQuery(sql: string, client: ClientSlug): Promise<AssistantQueryResult> {
  const keyword = firstKeyword(sql);
  if (keyword !== "select" && keyword !== "with") {
    return { error: "Solo se permiten consultas SELECT o WITH (de solo lectura)." };
  }
  if (hasChainedStatements(sql)) {
    return { error: "No se permite encadenar varias sentencias separadas por ';'." };
  }
  const disallowedTable = findDisallowedTable(sql, goldTablesFor(client));
  if (disallowedTable) {
    return { error: `La tabla "${disallowedTable}" no está disponible para este cliente.` };
  }

  try {
    // Decathlon sigue usando el pool histórico (SUPABASE_READONLY_DB_URL,
    // sin sufijo); cualquier otro cliente usa su propio pool por slug.
    const pool = client === "deca" ? getPool() : getClientPool(client);
    const result = await pool.query(sql);
    const rows = result.rows as Record<string, unknown>[];
    return { rows: rows.slice(0, MAX_ROWS) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
