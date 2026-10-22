import { listSavedReports } from "@/lib/assistant/savedReports";
import { Chart } from "../ReportChart";
import { mxBody, mxDisplay } from "../fonts";
import "../asistente.css";

export const dynamic = "force-dynamic";

const fechaFmt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
      <div className={`asis ${fontClassName}`}>
        <div className="asis-wrap">
          <header className="asis-head">
            <div className="asis-head-text">
              <span className="asis-kicker">Coolmetrics</span>
              <h1>Mis guardados</h1>
              <p className="asis-tagline">No pudimos identificar quién sos — entrá desde el portal.</p>
            </div>
          </header>
        </div>
      </div>
    );
  }

  const reports = await listSavedReports(userId);

  return (
    <div className={`asis ${fontClassName}`}>
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
            <div key={r.id} className="asis-bubble asis-bubble-assistant">
              <div className="asis-bubble-body">
                <p className="asis-saved-question">{r.question}</p>
                <p className="asis-summary">{r.summary}</p>
                {r.chart && <Chart chart={r.chart} />}
                <div className="asis-bubble-foot">
                  {r.sql && (
                    <details className="asis-sql">
                      <summary>Ver el SQL</summary>
                      <pre>{r.sql}</pre>
                    </details>
                  )}
                  <span className="asis-saved-date">{fechaFmt.format(new Date(r.created_at))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
