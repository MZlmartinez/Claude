import AsistenteChat, { type ChatTurn } from "../../AsistenteChat";
import PageHeightReporter from "../../PageHeightReporter";
import { AsistenteHeader } from "../../AsistenteHeader";
import { getSavedReport, listSavedReports } from "@/lib/assistant/savedReports";
import { mxBody, mxDisplay } from "../../fonts";
import "../../asistente.css";

export const dynamic = "force-dynamic";

// Abrir un guardado no muestra una ficha estática: carga el mismo chat del
// asistente con esa pregunta y esa respuesta ya puestas como primer
// intercambio, para poder seguir preguntándole al reporte (no solo verlo).
export default async function GuardadoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const u = sp.u;
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const fontClassName = `${mxDisplay.variable} ${mxBody.variable}`;

  const report = userId ? await getSavedReport(id, userId) : null;

  if (!report) {
    return (
      <PageHeightReporter fontClassName={fontClassName}>
        <div className="asis-layout">
          <div className="asis-wrap">
            <AsistenteHeader />
            <p className="asis-empty">No encontramos ese reporte.</p>
            <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId ?? "")}`}>
              ← Volver al asistente
            </a>
          </div>
        </div>
      </PageHeightReporter>
    );
  }

  const initialSaved = await listSavedReports(userId!);
  const initialTurns: ChatTurn[] = [
    { role: "user", content: report.question },
    {
      role: "assistant",
      question: report.question,
      report: { summary: report.summary, sql: report.sql, chart: report.chart },
      saveState: "saved",
      savedId: report.id,
    },
  ];

  return (
    <AsistenteChat fontClassName={fontClassName} userId={userId} initialSaved={initialSaved} initialTurns={initialTurns} />
  );
}
