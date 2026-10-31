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
import PrensaDashboard from "../PrensaDashboard";
import { prDisplay, prBody, prMono } from "../fonts";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";
import type { ClientSlug } from "@/lib/goldTables";

export const dynamic = "force-dynamic";

const ALLOWED_CLIENTS: ClientSlug[] = ["deca", "adecco"];

// Versión con candado de identidad (email+token) de /reportes/prensa,
// multi-cliente — ver PrensaDashboard.tsx.
export default async function SecurePrensaReportPage({
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
    getKpis(client, filters),
    getEvolucionSemanal(client, filters),
    getPorTier(client, filters),
    getNotasDestacadas(client, filters),
    getPorTipoMedio(client, filters),
    getPorFormato(client, filters),
    getTopVoceros(client, filters),
    getTopMedios(client, filters),
    getTopPeriodistas(client, filters),
    getActividad(client, filters),
    getNacionalInterior(client, filters),
    getProvincias(client, filters),
    getPorIndustria(client, filters),
    getPorCampana(client, filters),
    getGestionMencion(client, filters),
    getOrganicaPaga(client, filters),
    getVapPorTipoMedio(client, filters),
    getVapPorTier(client, filters),
    getDetalle(client, filters),
    getOpciones(client),
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
      basePath="/reportes/prensa/secure"
      email={email}
      token={token}
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
