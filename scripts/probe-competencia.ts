// Script temporal: valida columna por columna las dos tablas de Adecco
// (gold_prensa y gold_prensa_competencia) en busca de NaN/Infinity.
import { connectFabric } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

const FLOAT_LIKE_COLUMNS = [
  "tier",
  "periodista",
  "vocero",
  "formato_contenido",
  "nacional_o_interior",
  "provincia",
  "industria",
  "campaña",
  "tono",
  "mención_gestión",
  "pago_organico",
  "inversion",
  "reach",
  "hipervinculo",
];

async function checkTable(pool: Awaited<ReturnType<typeof connectFabric>>, table: string) {
  // Nota: esta conexión es al endpoint SQL (T-SQL), no a Spark — acá NO
  // existe isnan(), así que el único chequeo posible desde este script es
  // "la columna se puede leer sin que explote la conversión NaN/Infinity".
  console.log(`\n=== ${table} ===`);
  const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.${table}`);
  console.log("COUNT:", JSON.stringify(count.recordset));

  for (const c of FLOAT_LIKE_COLUMNS) {
    try {
      await pool.request().query(`SELECT TOP 5 [${c}] FROM prensa.${table}`);
      console.log(`LECTURA OK (endpoint SQL): ${c}`);
    } catch (error) {
      console.log(`LECTURA FALLA (endpoint SQL): ${c} -> ${String(error).split("\n")[0]}`);
    }
  }
}

async function main() {
  const sqlEndpoint = process.env.FABRIC_SQL_ENDPOINT_ADECCO;
  const database = process.env.FABRIC_DATABASE_ADECCO;
  if (!sqlEndpoint || !database) {
    console.error("Faltan FABRIC_SQL_ENDPOINT_ADECCO / FABRIC_DATABASE_ADECCO");
    process.exitCode = 1;
    return;
  }

  await ensureFabricCapacityActive();
  const pool = await connectFabric(sqlEndpoint, database);
  try {
    await checkTable(pool, "gold_prensa");
    await checkTable(pool, "gold_prensa_competencia");
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
