// Script temporal: prueba si TRY_CAST esquiva el error de NaN/Infinity al
// convertir columnas FLOAT de prensa.gold_prensa_competencia.
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
    const cols = ["tier", "periodista", "reach", "hipervinculo", "pago_organico"];
    for (const c of cols) {
      try {
        const r = await pool
          .request()
          .query(`SELECT TOP 5 TRY_CAST([${c}] AS VARCHAR(8000)) AS v FROM prensa.gold_prensa_competencia`);
        console.log(`TRY_CAST OK: ${c} ->`, JSON.stringify(r.recordset));
      } catch (error) {
        console.log(`TRY_CAST FALLA: ${c} -> ${String(error).split("\n")[0]}`);
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
