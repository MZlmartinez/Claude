import { Pool } from "pg";

// Conexión directa a Postgres (vía el connection pooler de Supabase) para
// los reportes: necesitamos correr SQL con CTEs que el cliente REST de
// supabase-js no puede expresar. Server-only — nunca se usa desde el browser.
let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      // El pooler de Supabase exige TLS; el certificado no valida contra
      // las CA por defecto de Node en algunos entornos serverless.
      ssl: { rejectUnauthorized: false },
      // El plan de Supabase tiene un límite total de 15 conexiones en modo
      // session — cada instancia de esta función se queda con pocas, para
      // no agotarlo si corren varias invocaciones a la vez.
      max: 2,
    });
  }
  return pool;
}

export async function queryReport<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}
