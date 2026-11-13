// Script temporal: inspecciona el esquema real de prensa.gold_prensa_competencia
// en el Lakehouse de Adecco en Fabric, antes de wirear el sync automático.
// Se corre una sola vez vía un workflow de GitHub Actions temporal y se borra
// después junto con ese workflow.
import { connectFabric } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

async function main() {
  const sqlEndpoint = process.env.FABRIC_SQL_ENDPOINT_ADECCO;
  const database = process.env.FABRIC_DATABASE_ADECCO;
  if (!sqlEndpoint || !database) {
    console.error("Faltan FABRIC_SQL_ENDPOINT_ADECCO / FABRIC_DATABASE_ADECCO");
    process.exitCode = 1;
    return;
  }

  console.log(`Conectando a endpoint=${sqlEndpoint} database=${database}`);
  await ensureFabricCapacityActive();
  const pool = await connectFabric(sqlEndpoint, database);
  try {
    const allTables = await pool.request().query(
      `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'prensa' ORDER BY TABLE_NAME`,
    );
    console.log("--- TABLAS EN SCHEMA prensa ---");
    console.log(JSON.stringify(allTables.recordset, null, 2));

    for (const t of ["gold_prensa", "gold_prensa_competencia"]) {
      try {
        const columns = await pool.request().query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, ORDINAL_POSITION
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = '${t}'
           ORDER BY ORDINAL_POSITION`,
        );
        console.log(`--- COLUMNS (${t}) ---`);
        console.log(JSON.stringify(columns.recordset, null, 2));

        if (!columns.recordset.length) {
          console.log(`La tabla prensa.${t} NO existe (todavía) en el endpoint SQL de esta base.`);
          continue;
        }

        const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.${t}`);
        console.log(`--- COUNT (${t}) ---`);
        console.log(JSON.stringify(count.recordset, null, 2));

        // Evita "id" a propósito: gold_prensa ya mostró el problema conocido
        // de NaN/Infinity en esa columna float rompiendo el SELECT * entero.
        const cols = columns.recordset
          .map((c: Record<string, unknown>) => String(c.COLUMN_NAME))
          .filter((c: string) => c.toLowerCase() !== "id");
        const select = cols.map((c: string) => `[${c}]`).join(", ");
        const sample = await pool.request().query(`SELECT TOP 3 ${select} FROM prensa.${t}`);
        console.log(`--- SAMPLE (${t}) ---`);
        console.log(JSON.stringify(sample.recordset, null, 2));
      } catch (error) {
        console.log(`--- ERROR en ${t} ---`);
        console.log(String(error));
      }
    }
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
