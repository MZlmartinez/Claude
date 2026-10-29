import {
  getCampanas,
  getContratos,
  getFormatos,
  getInfluencers,
  getInteracciones,
  getKpis,
  getOpciones,
  getPiezas,
  getTerritorios,
  type InfluencerFilters,
} from "@/lib/reports/influencers";
import InfluencersDashboard from "../InfluencersDashboard";
import { infDisplay, infBody, infMono } from "../fonts";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import type { ClientSlug } from "@/lib/goldTables";

export const dynamic = "force-dynamic";

const ALLOWED_CLIENTS: ClientSlug[] = ["deca", "adecco"];

// v2 de /reportes/influencers/secure — mismo candado de identidad, mismos
// datos, visor nuevo (ver InfluencersDashboard.tsx). En paralelo, sin
// reemplazar nada.
export default async function SecureInfluencersReportPageV2({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const email = one(params.u);
  const token = one(params.t);

  if (!email || !verifyEmailToken(email, token)) {
    return <Unauthorized reason="No se pudo verificar el usuario." />;
  }
  const clientSlug = await getClientSlugForEmail(email);
  if (!clientSlug || !ALLOWED_CLIENTS.includes(clientSlug as ClientSlug)) {
    return <Unauthorized reason="Este reporte no está disponible para tu cuenta." />;
  }
  const client = clientSlug as ClientSlug;

  const filters: InfluencerFilters = {
    campana: one(params.campana),
    territorio: one(params.territorio),
    influencer: one(params.influencer),
    formato: one(params.formato),
  };

  const [kpis, campanas, formatos, influencers, territorios, interacciones, piezas, contratos, opciones] =
    await Promise.all([
      getKpis(client, filters),
      getCampanas(client, filters),
      getFormatos(client, filters),
      getInfluencers(client, filters),
      getTerritorios(client, filters),
      getInteracciones(client, filters),
      getPiezas(client, filters),
      getContratos(client, filters),
      getOpciones(client),
    ]);

  return (
    <InfluencersDashboard
      filters={filters}
      kpis={kpis}
      campanas={campanas}
      formatos={formatos}
      influencers={influencers}
      territorios={territorios}
      interacciones={interacciones}
      piezas={piezas}
      contratos={contratos}
      opciones={opciones}
      fontClassName={`${infDisplay.variable} ${infBody.variable} ${infMono.variable}`}
    />
  );
}

function Unauthorized({ reason }: { reason: string }) {
  return (
    <div
      style={{
        padding: 40,
        fontFamily: "sans-serif",
        color: "#1d1d1b",
        background: "#ffffff",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <p>{reason}</p>
    </div>
  );
}
