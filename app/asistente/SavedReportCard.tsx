"use client";

import { useState } from "react";
import { Chart, type ChartSpec } from "./ReportChart";
import type { SavedReport } from "@/lib/assistant/savedReports";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function SavedReportCard({ report }: { report: SavedReport }) {
  const [chart, setChart] = useState<ChartSpec | null>(report.chart);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function rerun() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/asistente/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: report.sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "No se pudo actualizar.");
        return;
      }
      setChart((c) => (c ? { ...c, rows: data.rows } : c));
      setRefreshedAt(new Date());
      setState("idle");
    } catch (error) {
      setState("error");
      setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="asis-bubble asis-bubble-assistant">
      <div className="asis-bubble-body">
        <p className="asis-saved-question">{report.question}</p>
        <p className="asis-summary">{report.summary}</p>
        {chart && <Chart chart={chart} />}
        {state === "error" && <p className="asis-empty">Error al actualizar: {errorMsg}</p>}
        <div className="asis-bubble-foot">
          {report.sql && (
            <details className="asis-sql">
              <summary>Ver el SQL</summary>
              <pre>{report.sql}</pre>
            </details>
          )}
          <div className="asis-saved-actions">
            <span className="asis-saved-date">
              {refreshedAt ? `Actualizado ${fechaFmt.format(refreshedAt)}` : `Guardado ${fechaFmt.format(new Date(report.created_at))}`}
            </span>
            <button type="button" className="asis-save" onClick={rerun} disabled={state === "loading"}>
              {state === "loading" ? "Actualizando…" : "Volver a ejecutar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
