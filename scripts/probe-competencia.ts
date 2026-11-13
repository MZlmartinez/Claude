// Script temporal: confirma que el UPDATE (NaN -> NULL) en Fabric resolvió
// el problema antes de wirear el sync de verdad.
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
    const cols = [
      "cliente",
      "marca",
      "fecha",
      "tier",
      "medio",
      "tipo_de_medio",
      "periodista",
      "vocero",
      "formato_contenido",
      "nacional_o_interior",
      "provincia",
      "industria",
      "campaña",
      "tema",
      "tono",
      "mención_gestión",
      "pago_organico",
      "inversion",
      "reach",
      "cpe_vap",
      "link_a_nota",
      "hipervinculo",
    ];
    for (const c of cols) {
      try {
        await pool.request().query(`SELECT TOP 5 [${c}] FROM prensa.gold_prensa_competencia`);
        console.log(`OK: ${c}`);
      } catch (error) {
        console.log(`FALLA: ${c} -> ${String(error).split("\n")[0]}`);
      }
    }

    const select = cols.map((c) => `[${c}]`).join(", ");
    const sample = await pool.request().query(`SELECT TOP 3 ${select} FROM prensa.gold_prensa_competencia`);
    console.log("--- SAMPLE ---");
    console.log(JSON.stringify(sample.recordset, null, 2));

    const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.gold_prensa_competencia`);
    console.log("--- COUNT ---");
    console.log(JSON.stringify(count.recordset, null, 2));
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
