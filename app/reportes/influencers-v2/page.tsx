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
import { infDisplay, infBody, infMono } from "./fonts";

export const dynamic = "force-dynamic";

// v2 en paralelo a /reportes/influencers — ver InfluencersDashboard.tsx.
// Mismos datos reales, visor nuevo. No reemplaza nada todavía.
export default async function InfluencersReportPageV2({
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
      fontClassName={`${infDisplay.variable} ${infBody.variable} ${infMono.variable}`}
    />
  );
}
