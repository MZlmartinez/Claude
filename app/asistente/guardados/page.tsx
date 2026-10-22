import { listSavedReports } from "@/lib/assistant/savedReports";
import SavedReportCard from "../SavedReportCard";
import PageHeightReporter from "../PageHeightReporter";
import { mxBody, mxDisplay } from "../fonts";
import "../asistente.css";

export const dynamic = "force-dynamic";

export default async function GuardadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const u = params.u;
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const fontClassName = `${mxDisplay.variable} ${mxBody.variable}`;

  if (!userId) {
    return (
      <PageHeightReporter fontClassName={fontClassName}>
        <div className="asis-wrap">
          <header className="asis-head">
            <div className="asis-head-text">
              <span className="asis-kicker">Coolmetrics</span>
              <h1>Mis guardados</h1>
              <p className="asis-tagline">No pudimos identificar quién sos — entrá desde el portal.</p>
            </div>
          </header>
        </div>
      </PageHeightReporter>
    );
  }

  const reports = await listSavedReports(userId);

  return (
    <PageHeightReporter fontClassName={fontClassName}>
      <div className="asis-wrap">
        <header className="asis-head">
          <div className="asis-head-text">
            <span className="asis-kicker">Coolmetrics</span>
            <h1>Mis guardados</h1>
            <p className="asis-tagline">Los reportes que guardaste del asistente.</p>
          </div>
        </header>

        <div className="asis-thread">
          <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId)}`}>
            ← Volver al asistente
          </a>

          {reports.length === 0 && <p className="asis-empty">Todavía no guardaste ningún reporte.</p>}

          {reports.map((r) => (
            <SavedReportCard key={r.id} report={r} />
          ))}
        </div>
      </div>
    </PageHeightReporter>
  );
}
