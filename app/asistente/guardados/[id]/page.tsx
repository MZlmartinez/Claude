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
  const t = sp.t;
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const token = (Array.isArray(t) ? t[0] : t) || null;
  const fontClassName = `${mxDisplay.variable} ${mxBody.variable}`;

  const report = userId ? await getSavedReport(id, userId) : null;

  if (!report) {
    return (
      <PageHeightReporter fontClassName={fontClassName}>
        <AsistenteHeader savedCount={0} />
        <div className="asis-layout">
          <div className="asis-wrap">
            <p className="asis-empty">No encontramos ese reporte.</p>
            <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId ?? "")}&t=${encodeURIComponent(token ?? "")}`}>
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
    <AsistenteChat
      fontClassName={fontClassName}
      userId={userId}
      token={token}
      initialSaved={initialSaved}
      initialTurns={initialTurns}
    />
  );
}
