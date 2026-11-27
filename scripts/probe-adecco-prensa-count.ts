// Script temporal: cuenta filas y rango de fechas de prensa.gold_prensa
// en el Lakehouse de Adecco, para comparar origen vs. destino después de
// reincorporar gold_prensa_adecco al sync. Se borra apenas se resuelva.
import { queryFabricRaw } from "../lib/fabric";
import { ensureFabricCapacityActive, pauseFabricCapacity } from "../lib/fabricCapacity";

async function main() {
  await ensureFabricCapacityActive();
  try {
    const rows = await queryFabricRaw(
      process.env.FABRIC_SQL_ENDPOINT_ADECCO!,
      process.env.FABRIC_DATABASE_ADECCO!,
      `SELECT COUNT(*) AS total, MIN(fecha) AS min_fecha, MAX(fecha) AS max_fecha FROM prensa.gold_prensa`,
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
