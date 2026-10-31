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
  getRangoFechas,
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

// Ruta sin candado de identidad, fija a Adecco (a diferencia de Influencers,
// que es de Decathlon — este reporte de Prensa es el de Adecco) — ver
// secure/page.tsx para la versión multi-cliente.
export default async function PrensaReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const desdeParam = one(params.desde);
  const hastaParam = one(params.hasta);
  // Si no vienen en la URL, arranca con el rango completo de datos (igual
  // que el artifact de referencia, que no deja Desde/Hasta vacíos).
  const rango = !desdeParam && !hastaParam ? await getRangoFechas("adecco") : null;

  const filters: PrensaFilters = {
    desde: desdeParam ?? rango?.desde ?? null,
    hasta: hastaParam ?? rango?.hasta ?? null,
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
    getKpis("adecco", filters),
    getEvolucionSemanal("adecco", filters),
    getPorTier("adecco", filters),
    getNotasDestacadas("adecco", filters),
    getPorTipoMedio("adecco", filters),
    getPorFormato("adecco", filters),
    getTopVoceros("adecco", filters),
    getTopMedios("adecco", filters),
    getTopPeriodistas("adecco", filters),
    getActividad("adecco", filters),
    getNacionalInterior("adecco", filters),
    getProvincias("adecco", filters),
    getPorIndustria("adecco", filters),
    getPorCampana("adecco", filters),
    getGestionMencion("adecco", filters),
    getOrganicaPaga("adecco", filters),
    getVapPorTipoMedio("adecco", filters),
    getVapPorTier("adecco", filters),
    getDetalle("adecco", filters),
    getOpciones("adecco"),
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
