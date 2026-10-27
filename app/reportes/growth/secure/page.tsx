import {
  getCanalDia,
  getCanales,
  getDispositivo,
  getMensual,
  getNegocioDia,
  getProductoDia,
  getTrafico,
  getTraficoDia,
} from "@/lib/reports/growth";
import GrowthDashboard from "../GrowthDashboard";
import { mxBody, mxDisplay } from "../fonts";
import { getClientSlugForEmail, verifyEmailToken } from "@/lib/assistant/clientAuth";

export const dynamic = "force-dynamic";

// Mismo esquema que /reportes/influencers/secure: candado de identidad en
// paralelo, sin tocar /reportes/growth (que Softr sigue embebiendo hoy via
// el link estático de Airtable). Growth es de Decathlon únicamente — no
// hay datos equivalentes de otro cliente, así que no hace falta
// generalizar lib/reports/growth.ts por ahora (a diferencia de
// influencers.ts, que sí necesitó elegir tabla por cliente).
export default async function SecureGrowthReportPage({
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
  if (clientSlug !== "deca") {
    return <Unauthorized reason="Este reporte no está disponible para tu cuenta." />;
  }

  const [canalDia, canales, dispositivo, mensual, negocioDia, productoDia, trafico, traficoDia] = await Promise.all([
    getCanalDia(),
    getCanales(),
    getDispositivo(),
    getMensual(),
    getNegocioDia(),
    getProductoDia(),
    getTrafico(),
    getTraficoDia(),
  ]);

  return (
    <GrowthDashboard
      canalDia={canalDia}
      canales={canales}
      dispositivo={dispositivo}
      mensual={mensual}
      negocioDia={negocioDia}
      productoDia={productoDia}
      trafico={trafico}
      traficoDia={traficoDia}
      fontClassName={`${mxDisplay.variable} ${mxBody.variable}`}
    />
  );
}

// Fondo y color propios, no heredados: si esto se embebe en un iframe con
// fondo oscuro (como Softr), un texto gris sin fondo propio puede quedar
// invisible en vez de mostrar el motivo del error.
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
