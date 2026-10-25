import { Chart } from "./ReportChart";
import type { SavedReport } from "@/lib/assistant/savedReports";

const fechaFmt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Miniatura de un reporte guardado para la grilla de "Mis guardados" — el
// gráfico real se reusa achicado (mismo componente que en el chat), no una
// imagen aparte, así nunca queda desactualizado respecto al reporte real.
export default function SavedReportThumb({
  report,
  userId,
  token,
}: {
  report: SavedReport;
  userId: string;
  token: string | null;
}) {
  return (
    <a
      className="asis-thumb"
      href={`/asistente/guardados/${report.id}?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token ?? "")}`}
    >
      <span className="asis-thumb-q">{report.question}</span>
      <div className="asis-thumb-chart">{report.chart ? <Chart chart={report.chart} /> : <p className="asis-empty">Sin gráfico.</p>}</div>
      <span className="asis-thumb-date">{fechaFmt.format(new Date(report.created_at))}</span>
    </a>
  );
}
