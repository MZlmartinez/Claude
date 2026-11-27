// Script temporal: confirmar que el service principal (COOLmetrics_Fabric_API)
// ya puede leer prensa.gold_prensa_competencia_sov después del GRANT corrido
// manualmente en el portal de Fabric.
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
    console.log("\n=== COLUMNS de prensa.gold_prensa_competencia_sov ===");
    const columns = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = 'gold_prensa_competencia_sov'
       ORDER BY ORDINAL_POSITION`,
    );
    console.log("COLUMNS:", JSON.stringify(columns.recordset));

    console.log("\n=== SELECT directo ===");
    try {
      const rows = await pool
        .request()
        .query(`SELECT TOP 5 * FROM prensa.gold_prensa_competencia_sov`);
      console.log("SELECT OK, muestra:", JSON.stringify(rows.recordset));
      const count = await pool
        .request()
        .query(`SELECT COUNT(*) AS total FROM prensa.gold_prensa_competencia_sov`);
      console.log("COUNT:", JSON.stringify(count.recordset));
    } catch (error) {
      console.log("SELECT FALLA:", String(error).split("\n")[0]);
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
