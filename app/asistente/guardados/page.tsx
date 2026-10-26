import { listSavedReports } from "@/lib/assistant/savedReports";
import SavedReportThumb from "../SavedReportThumb";
import PageHeightReporter from "../PageHeightReporter";
import { AsistenteHeader } from "../AsistenteHeader";
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
  const t = params.t;
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const token = (Array.isArray(t) ? t[0] : t) || null;
  const fontClassName = `${mxDisplay.variable} ${mxBody.variable}`;

  if (!userId) {
    return (
      <PageHeightReporter fontClassName={fontClassName}>
        <AsistenteHeader savedCount={0} />
        <div className="asis-layout">
          <div className="asis-wrap">
            <h2 className="asis-section-title">Mis reportes guardados</h2>
            <p className="asis-empty">No pudimos identificar quién sos — entrá desde el portal.</p>
          </div>
        </div>
      </PageHeightReporter>
    );
  }

  const reports = await listSavedReports(userId);

  return (
    <PageHeightReporter fontClassName={fontClassName}>
      <AsistenteHeader savedCount={reports.length} />
      <div className="asis-layout">
        <div className="asis-wrap">
          <h2 className="asis-section-title">Mis reportes guardados</h2>

          <div className="asis-thread">
            <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token ?? "")}`}>
              ← Volver al asistente
            </a>

            {reports.length === 0 && <p className="asis-empty">Todavía no guardaste ningún reporte.</p>}

            <div className="asis-thumb-grid">
              {reports.map((r) => (
                <SavedReportThumb key={r.id} report={r} userId={userId} token={token} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageHeightReporter>
  );
}
