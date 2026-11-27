// Script temporal: ver si prensa.gold_prensa (Adecco) tiene cpe_vap no-nulo
// en origen (Fabric) — en Supabase llega 100% NULL (1106/1106 filas).
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
    const stats = await pool.request().query(
      `SELECT COUNT(*) AS total, COUNT([cpe_vap]) AS vap_no_null, SUM([cpe_vap]) AS vap_sum,
              COUNT([reach]) AS reach_no_null, SUM([reach]) AS reach_sum
       FROM prensa.gold_prensa`,
    );
    console.log("STATS gold_prensa:", JSON.stringify(stats.recordset));

    const sample = await pool.request().query(`SELECT TOP 5 cliente, marca, fecha, cpe_vap, reach FROM prensa.gold_prensa ORDER BY fecha DESC`);
    console.log("SAMPLE:", JSON.stringify(sample.recordset));
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
