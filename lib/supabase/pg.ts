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
      // SUPABASE_DB_URL apunta al pooler en modo Transaction (puerto 6543),
      // que multiplexa muchas conexiones cortas sobre pocas conexiones
      // reales a Postgres — a diferencia del modo Session (5432, límite
      // global bajo en el plan Free) que usábamos antes. Se mantiene max
      // bajo por instancia igual, por prolijidad, no porque haga falta
      // para no agotar un límite global como pasaba con Session.
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
