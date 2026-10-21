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
import GrowthDashboard from "./GrowthDashboard";
import { mxBody, mxDisplay } from "./fonts";

export const dynamic = "force-dynamic";

// "diario" y "productos" (los datasets del artifact original) no quedaron
// cableados a ningún gráfico/tabla de este dashboard — ver lib/reports/growth.ts.
export default async function GrowthReportPage() {
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
