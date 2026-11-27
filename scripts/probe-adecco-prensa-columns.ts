// Script temporal: lista las columnas reales de prensa.gold_prensa en el
// Lakehouse de Adecco, para diagnosticar el error "Invalid column name
// 'mención_gestión'" del sync (ver lib/goldTables.ts, selectColumnsOverrides
// de gold_prensa_adecco). Se borra apenas se resuelva.
import { queryFabricRaw } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

async function main() {
  await ensureFabricCapacityActive();
  try {
    const rows = await queryFabricRaw(
      process.env.FABRIC_SQL_ENDPOINT_ADECCO!,
      process.env.FABRIC_DATABASE_ADECCO!,
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'prensa' AND TABLE_NAME = 'gold_prensa' ORDER BY ORDINAL_POSITION`,
    );
    console.table(rows);
  } finally {
    await pauseFabricCapacity();
  }
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});
