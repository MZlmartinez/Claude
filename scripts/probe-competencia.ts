// Script temporal: chequeo final de gold_prensa_competencia (todas las
// columnas + conteo) para comparar contra lo que ya hay en Supabase.
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
    const safeCols: string[] = [];
    for (const c of cols) {
      try {
        await pool.request().query(`SELECT TOP 5 [${c}] FROM prensa.gold_prensa_competencia`);
        console.log(`OK: ${c}`);
        safeCols.push(c);
      } catch (error) {
        console.log(`FALLA: ${c} -> ${String(error).split("\n")[0]}`);
      }
    }

    const count = await pool.request().query(`SELECT COUNT(*) AS total FROM prensa.gold_prensa_competencia`);
    console.log("--- COUNT ---");
    console.log(JSON.stringify(count.recordset, null, 2));

    const marcas = await pool.request().query(
      `SELECT marca, COUNT(*) AS total FROM prensa.gold_prensa_competencia GROUP BY marca ORDER BY marca`,
    );
    console.log("--- MARCAS ---");
    console.log(JSON.stringify(marcas.recordset, null, 2));

    if (safeCols.length === cols.length) {
      const select = safeCols.map((c) => `[${c}]`).join(", ");
      const sample = await pool.request().query(`SELECT TOP 3 ${select} FROM prensa.gold_prensa_competencia`);
      console.log("--- SAMPLE (todas las columnas) ---");
      console.log(JSON.stringify(sample.recordset, null, 2));
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
