// Antes de sincronizar necesitamos que la capacidad de Fabric esté
// encendida — si quedó pausada (se pausa sola por inactividad) el query a
// Fabric falla directo. Azure no ofrece una plantilla nativa de
// pausar/reanudar programado para este tipo de recurso (ver "Automation"
// en el portal), así que lo resolvemos acá: pedimos un token con el mismo
// service principal que ya usamos para leer Fabric, y llamamos a la API de
// Azure Resource Manager para reanudar la capacidad si hace falta.
const ARM_API_VERSION = "2023-11-01";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la env var ${name}`);
  return value;
}

async function getArmToken(): Promise<string> {
  const tenantId = requireEnv("AZURE_TENANT_ID");
  const clientId = requireEnv("AZURE_CLIENT_ID");
  const clientSecret = requireEnv("AZURE_CLIENT_SECRET");

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://management.azure.com/.default",
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener token de Azure Resource Manager: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function capacityUrl(subscriptionId: string, resourceGroup: string, capacityName: string) {
  return `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Fabric/capacities/${capacityName}`;
}

async function getCapacityState(
  token: string,
  subscriptionId: string,
  resourceGroup: string,
  capacityName: string,
): Promise<string> {
  const res = await fetch(
    `${capacityUrl(subscriptionId, resourceGroup, capacityName)}?api-version=${ARM_API_VERSION}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`No se pudo leer el estado de la capacidad de Fabric: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { properties?: { state?: string } };
  return data.properties?.state ?? "Unknown";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_WAIT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

// Si la capacidad ya está activa, no hace nada. Si está pausada, la
// reanuda y espera (polling) a que quede Active antes de devolver el
// control — recién ahí tiene sentido intentar conectar a Fabric.
export async function ensureFabricCapacityActive(): Promise<void> {
  const subscriptionId = requireEnv("AZURE_SUBSCRIPTION_ID");
  const resourceGroup = requireEnv("AZURE_FABRIC_RESOURCE_GROUP");
  const capacityName = requireEnv("AZURE_FABRIC_CAPACITY_NAME");

  const token = await getArmToken();

  const state = await getCapacityState(token, subscriptionId, resourceGroup, capacityName);
  console.log(`Estado actual de la capacidad de Fabric: ${state}`);

  if (state === "Active") return;

  if (state === "Paused") {
    console.log("Reanudando la capacidad de Fabric...");
    const resumeRes = await fetch(
      `${capacityUrl(subscriptionId, resourceGroup, capacityName)}/resume?api-version=${ARM_API_VERSION}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resumeRes.ok && resumeRes.status !== 202) {
      throw new Error(`No se pudo reanudar la capacidad de Fabric: ${resumeRes.status} ${await resumeRes.text()}`);
    }
  } else {
    console.log(`La capacidad está en transición (${state}), esperando a que se estabilice...`);
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const current = await getCapacityState(token, subscriptionId, resourceGroup, capacityName);
    console.log(`Estado de la capacidad de Fabric: ${current}`);
    if (current === "Active") return;
  }

  throw new Error("La capacidad de Fabric no llegó a estado Active dentro del tiempo de espera (5 min)");
}
