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
import { mxBody, mxDisplay } from "../fonts";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";

export const dynamic = "force-dynamic";

// Versión con candado de identidad de /reportes/influencers, en paralelo
// sin tocar esa ruta (que Softr sigue embebiendo hoy via el link estático
// de Airtable). Primer piloto del esquema nuevo: email+token firmado en
// vez de "quien tenga el link, entra" — mismo mecanismo que ya prueba
// app/api/asistente/chat/route.ts. Si esto reemplaza al link de Airtable
// más adelante, recién ahí se puede borrar la ruta vieja.
export default async function SecureInfluencersReportPage({
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
  // gold_influencers (y lib/reports/influencers.ts) son exclusivos de
  // Decathlon — ningún otro cliente tiene hoy esa tabla ni esos datos.
  if (clientSlug !== "deca") {
    return <Unauthorized reason="Este reporte no está disponible para tu cuenta." />;
  }

  const filters: InfluencerFilters = {
    campana: one(params.campana),
    territorio: one(params.territorio),
    influencer: one(params.influencer),
    formato: one(params.formato),
  };

  const [kpis, campanas, formatos, influencers, territorios, interacciones, piezas, contratos, opciones] =
    await Promise.all([
      getKpis(filters),
      getCampanas(filters),
      getFormatos(filters),
      getInfluencers(filters),
      getTerritorios(filters),
      getInteracciones(filters),
      getPiezas(filters),
      getContratos(filters),
      getOpciones(),
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
      fontClassName={`${mxDisplay.variable} ${mxBody.variable}`}
    />
  );
}

// Fondo y color propios, no heredados: si esto se embebe en un iframe con
// mx.css de fondo oscuro (como Softr), un texto gris sin fondo propio
// puede quedar invisible en vez de mostrar el motivo del error.
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
