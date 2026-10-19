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

export default async function InfluencersReportPage({
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
