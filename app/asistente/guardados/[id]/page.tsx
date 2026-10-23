import { getSavedReport } from "@/lib/assistant/savedReports";
import SavedReportCard from "../../SavedReportCard";
import PageHeightReporter from "../../PageHeightReporter";
import { mxBody, mxDisplay } from "../../fonts";
import "../../asistente.css";

export const dynamic = "force-dynamic";

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

  return (
    <PageHeightReporter fontClassName={fontClassName}>
      <div className="asis-wrap">
        <header className="asis-head">
          <div className="asis-head-text">
            <span className="asis-kicker">Coolmetrics</span>
            <h1>Reporte guardado</h1>
            <p className="asis-tagline">
              <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId ?? "")}`}>
                ← Volver al asistente
              </a>
            </p>
          </div>
        </header>

        <div className="asis-thread">
          {!report && <p className="asis-empty">No encontramos ese reporte.</p>}
          {report && <SavedReportCard report={report} />}
        </div>
      </div>
    </PageHeightReporter>
  );
}
