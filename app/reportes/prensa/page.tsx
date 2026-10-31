import {
  getActividad,
  getDetalle,
  getEvolucionSemanal,
  getGestionMencion,
  getKpis,
  getNacionalInterior,
  getNotasDestacadas,
  getOpciones,
  getOrganicaPaga,
  getPorCampana,
  getPorFormato,
  getPorIndustria,
  getPorTier,
  getPorTipoMedio,
  getProvincias,
  getTopMedios,
  getTopPeriodistas,
  getTopVoceros,
  getVapPorTier,
  getVapPorTipoMedio,
  type PrensaFilters,
} from "@/lib/reports/prensa";
import PrensaDashboard from "./PrensaDashboard";
import { prDisplay, prBody, prMono } from "./fonts";

export const dynamic = "force-dynamic";

// Ruta sin candado de identidad, fija a Decathlon — ver secure/page.tsx
// para la versión multi-cliente (mismo criterio que influencers/page.tsx).
export default async function PrensaReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const filters: PrensaFilters = {
    desde: one(params.desde),
    hasta: one(params.hasta),
    industria: one(params.industria),
    campana: one(params.campana),
    tipoMedio: one(params.medio),
  };

  const [
    kpis,
    semanal,
    porTier,
    destacadas,
    porTipoMedio,
    porFormato,
    topVoceros,
    topMedios,
    topPeriodistas,
    actividad,
    nacionalInterior,
    provincias,
    porIndustria,
    porCampana,
    gestionMencion,
    organicaPaga,
    vapPorTipoMedio,
    vapPorTier,
    detalle,
    opciones,
  ] = await Promise.all([
    getKpis("deca", filters),
    getEvolucionSemanal("deca", filters),
    getPorTier("deca", filters),
    getNotasDestacadas("deca", filters),
    getPorTipoMedio("deca", filters),
    getPorFormato("deca", filters),
    getTopVoceros("deca", filters),
    getTopMedios("deca", filters),
    getTopPeriodistas("deca", filters),
    getActividad("deca", filters),
    getNacionalInterior("deca", filters),
    getProvincias("deca", filters),
    getPorIndustria("deca", filters),
    getPorCampana("deca", filters),
    getGestionMencion("deca", filters),
    getOrganicaPaga("deca", filters),
    getVapPorTipoMedio("deca", filters),
    getVapPorTier("deca", filters),
    getDetalle("deca", filters),
    getOpciones("deca"),
  ]);

  return (
    <PrensaDashboard
      filters={filters}
      kpis={kpis}
      semanal={semanal}
      porTier={porTier}
      destacadas={destacadas}
      porTipoMedio={porTipoMedio}
      porFormato={porFormato}
      topVoceros={topVoceros}
      topMedios={topMedios}
      topPeriodistas={topPeriodistas}
      actividad={actividad}
      nacionalInterior={nacionalInterior}
      provincias={provincias}
      porIndustria={porIndustria}
      porCampana={porCampana}
      gestionMencion={gestionMencion}
      organicaPaga={organicaPaga}
      vapPorTipoMedio={vapPorTipoMedio}
      vapPorTier={vapPorTier}
      detalle={detalle}
      opciones={opciones}
      fontClassName={`${prDisplay.variable} ${prBody.variable} ${prMono.variable}`}
      basePath="/reportes/prensa"
    />
  );
}
