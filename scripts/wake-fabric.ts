// Script temporal: solo despierta la capacidad de Fabric de Adecco y la
// deja activa (no la pausa) para que el usuario pueda correr consultas a
// mano en la web de Fabric sin que le tire "CapacityNotActive".
import { ensureFabricCapacityActive } from "../lib/fabricCapacity";

async function main() {
  await ensureFabricCapacityActive();
  console.log("Capacidad activa. La dejo así (no la pauso) por los próximos minutos.");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
