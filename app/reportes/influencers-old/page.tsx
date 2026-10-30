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
import InfluencersDashboard from "./InfluencersDashboard";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// Respaldo de la versión anterior de /reportes/influencers, reemplazada
// por el diseño nuevo (ver app/reportes/influencers). Sigue sirviendo en
// /reportes/influencers-old, pero nada la linkea — queda solo por si hace
// falta volver atrás.
export default async function InfluencersReportPageOld({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const filters: InfluencerFilters = {
    campana: one(params.campana),
    territorio: one(params.territorio),
    influencer: one(params.influencer),
    formato: one(params.formato),
  };

  // Ruta vieja, sin candado de identidad — se mantiene fija a Decathlon,
  // como siempre fue (ver app/reportes/influencers/secure/page.tsx para
  // la versión nueva, multi-cliente).
  const [kpis, campanas, formatos, influencers, territorios, interacciones, piezas, contratos, opciones] =
    await Promise.all([
      getKpis("deca", filters),
      getCampanas("deca", filters),
      getFormatos("deca", filters),
      getInfluencers("deca", filters),
      getTerritorios("deca", filters),
      getInteracciones("deca", filters),
      getPiezas("deca", filters),
      getContratos("deca", filters),
      getOpciones("deca"),
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
