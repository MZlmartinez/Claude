// Script temporal: reintentar prensa.gold_prensa_competencia_sov en Fabric
// (Adecco) — el probe anterior no la encontró en INFORMATION_SCHEMA.TABLES,
// pero el SQL analytics endpoint de Fabric puede tardar en reflejar tablas
// recién creadas. Se prueba de nuevo y se listan todas las tablas del
// schema "prensa" para confirmar el estado actual.
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
    console.log("\n=== Tablas actuales en el schema prensa ===");
    const tables = await pool
      .request()
      .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'prensa'`);
    console.log("TABLAS:", JSON.stringify(tables.recordset));

    console.log("\n=== SELECT directo a prensa.gold_prensa_competencia_sov ===");
    try {
      const rows = await pool
        .request()
        .query(`SELECT TOP 5 * FROM prensa.gold_prensa_competencia_sov`);
      console.log("SELECT OK, muestra:", JSON.stringify(rows.recordset));
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
