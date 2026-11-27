// Script temporal: columnas/tipos reales (INFORMATION_SCHEMA.COLUMNS) y
// conteo de prensa.gold_prensa_competencia y prensa.gold_prensa_competencia_sov
// en el Lakehouse de Adecco, antes de sumarlas a la réplica diaria.
import { connectFabric } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

const COMPETENCIA_SELECT_COLUMNS = [
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
    console.log("\n=== prensa.gold_prensa_competencia: SELECT real (mismas columnas que gold_prensa_adecco) ===");
    try {
      const select = COMPETENCIA_SELECT_COLUMNS.map((c) => `[${c}]`).join(", ");
      const rows = await pool
        .request()
        .query(`SELECT TOP 5 ${select} FROM prensa.gold_prensa_competencia`);
      console.log("SELECT OK, muestra:", JSON.stringify(rows.recordset));
    } catch (error) {
      console.log("SELECT FALLA:", String(error).split("\n")[0]);
    }

    console.log("\n=== Buscando 'sov' en todo el catálogo (cualquier schema) ===");
    const found = await pool.request().query(
      `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME LIKE '%sov%' OR TABLE_NAME LIKE '%competencia%'`,
    );
    console.log("TABLAS/VISTAS:", JSON.stringify(found.recordset));
  } finally {
    await pool.close();
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
