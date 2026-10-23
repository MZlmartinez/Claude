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
  const userId = (Array.isArray(u) ? u[0] : u) || null;
  const fontClassName = `${mxDisplay.variable} ${mxBody.variable}`;

  if (!userId) {
    return (
      <PageHeightReporter fontClassName={fontClassName}>
        <div className="asis-wrap">
          <AsistenteHeader />
          <p className="asis-empty">No pudimos identificar quién sos — entrá desde el portal.</p>
        </div>
      </PageHeightReporter>
    );
  }

  const reports = await listSavedReports(userId);

  return (
    <PageHeightReporter fontClassName={fontClassName}>
      <div className="asis-wrap">
        <AsistenteHeader />

        <div className="asis-thread">
          <a className="asis-saved-link" href={`/asistente?u=${encodeURIComponent(userId)}`}>
            ← Volver al asistente
          </a>

          {reports.length === 0 && <p className="asis-empty">Todavía no guardaste ningún reporte.</p>}

          <div className="asis-thumb-grid">
            {reports.map((r) => (
              <SavedReportThumb key={r.id} report={r} userId={userId} />
            ))}
          </div>
        </div>
      </div>
    </PageHeightReporter>
  );
}
