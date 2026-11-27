// Script temporal: columnas/tipos reales (INFORMATION_SCHEMA.COLUMNS) y
// conteo de prensa.gold_prensa_competencia y prensa.gold_prensa_competencia_sov
// en el Lakehouse de Adecco, antes de sumarlas a la réplica diaria.
import { connectFabric } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

async function inspect(pool: Awaited<ReturnType<typeof connectFabric>>, table: string) {
  console.log(`\n=== prensa.${table} ===`);
  const columns = await pool.request().query(
    `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = '${table}'
     ORDER BY ORDINAL_POSITION`,
  );
  console.log("COLUMNS:", JSON.stringify(columns.recordset));

  const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.${table}`);
  console.log("COUNT:", JSON.stringify(count.recordset));
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
    await inspect(pool, "gold_prensa_competencia");
    await inspect(pool, "gold_prensa_competencia_sov");
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
