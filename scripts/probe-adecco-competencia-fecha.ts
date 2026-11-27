// Script temporal: re-chequear si "fecha" de prensa.gold_prensa_competencia
// (Adecco) sigue corrupta (texto tipo java.util.GregorianCalendar[...] en
// vez de una fecha real), antes de sumarla a la réplica diaria.
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
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = 'gold_prensa_competencia'
       ORDER BY ORDINAL_POSITION`,
    );
    console.log("COLUMNS:", JSON.stringify(columns.recordset));

    const rows = await pool.request().query(`SELECT TOP 10 fecha FROM prensa.gold_prensa_competencia ORDER BY NEWID()`);
    console.log("FECHA SAMPLE:", JSON.stringify(rows.recordset));
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
