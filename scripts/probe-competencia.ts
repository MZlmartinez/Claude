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

  await ensureFabricCapacityActive();
  const pool = await connectFabric(sqlEndpoint, database);
  try {
    const columns = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = 'gold_prensa_competencia'
       ORDER BY ORDINAL_POSITION`,
    );
    console.log("--- COLUMNS (gold_prensa_competencia) ---");
    console.log(JSON.stringify(columns.recordset, null, 2));

    if (!columns.recordset.length) {
      console.log("La tabla prensa.gold_prensa_competencia TODAVÍA NO aparece en el endpoint SQL.");
      return;
    }

    const cols = columns.recordset
      .map((c: Record<string, unknown>) => String(c.COLUMN_NAME))
      .filter((c: string) => c.toLowerCase() !== "id");
    const select = cols.map((c: string) => `[${c}]`).join(", ");

    const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.gold_prensa_competencia`);
    console.log("--- COUNT ---");
    console.log(JSON.stringify(count.recordset, null, 2));

    const marcas = await pool.request().query(
      `SELECT marca, COUNT(*) AS total FROM prensa.gold_prensa_competencia GROUP BY marca ORDER BY marca`,
    );
    console.log("--- MARCAS ---");
    console.log(JSON.stringify(marcas.recordset, null, 2));

    const sample = await pool.request().query(`SELECT TOP 3 ${select} FROM prensa.gold_prensa_competencia`);
    console.log("--- SAMPLE ---");
    console.log(JSON.stringify(sample.recordset, null, 2));
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
