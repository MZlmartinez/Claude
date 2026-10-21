import { Pool } from "pg";

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
      max: 2,
    });
  }
  return pool;
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

// Defensa en profundidad además de los permisos ya puestos en la base
// (decathlon_readonly solo tiene SELECT sobre las tablas gold_*): esto
// evita que una consulta mal armada por el modelo encadene sentencias o
// intente algo que no sea una lectura, antes de que Postgres la vea.
export async function runAssistantQuery(sql: string): Promise<AssistantQueryResult> {
  const keyword = firstKeyword(sql);
  if (keyword !== "select" && keyword !== "with") {
    return { error: "Solo se permiten consultas SELECT o WITH (de solo lectura)." };
  }
  if (hasChainedStatements(sql)) {
    return { error: "No se permite encadenar varias sentencias separadas por ';'." };
  }

  try {
    const result = await getPool().query(sql);
    const rows = result.rows as Record<string, unknown>[];
    return { rows: rows.slice(0, MAX_ROWS) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
