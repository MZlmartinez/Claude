"use client";

import { useEffect, useRef, useState } from "react";
import type { jsPDF as JsPDFInstance } from "jspdf";
import "./asistente.css";
import { Chart, AsisAvatar, type ChartSpec } from "./ReportChart";
import { AsistenteHeader } from "./AsistenteHeader";
import type { SavedReport } from "@/lib/assistant/savedReports";

type AssistantReport = { summary: string; sql: string; chart: ChartSpec | null };

type SaveState = "idle" | "saving" | "saved" | "deleting" | "error";

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; question: string; report: AssistantReport; saveState: SaveState; savedId: string | null }
  | { role: "assistant-error"; message: string };

// Alto fijo del iframe embebido en Softr, en píxeles — se reporta UNA sola
// vez al montar y nunca cambia, así el iframe nunca vuelve a redimensionar
// la página de Softr (ver el comentario sobre por qué en el useEffect de
// abajo). Tiene que ser el mismo valor que .asis { height } en asistente.css.
const FRAME_HEIGHT = 880;

const sidebarFecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

// Mismo criterio que las sugerencias (.asis-sugg-*): un color de borde
// distinto por ítem guardado, ciclando por índice, en vez de todos iguales.
const SIDEBAR_COLORS = ["k1", "k2", "k4"] as const;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "reporte"
  );
}

function downloadBlob(filename: string, content: string | Blob, mime?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV con separador ";" y BOM UTF-8 — así Excel en configuración regional
// es-AR (coma como separador decimal) lo abre bien y respeta los acentos,
// en vez de interpretarlo como una sola columna con comas sueltas.
function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(";"), ...rows.map((row) => columns.map((c) => escape(row[c])).join(";"))];
  return "﻿" + lines.join("\n");
}

// Colores de marca MOSCU/Coolmetrics (mismos que --asis-bg/--asis-card/
// --asis-accent en asistente.css) — el PDF tiene que verse como parte del
// mismo producto, no una captura de pantalla pelada.
const PDF_BG: [number, number, number] = [29, 29, 27]; // #1d1d1b
const PDF_CARD: [number, number, number] = [39, 38, 42]; // #27262a
const PDF_LINE: [number, number, number] = [56, 55, 59]; // #38373b
const PDF_ACCENT: [number, number, number] = [216, 252, 74]; // #d8fc4a
const PDF_FG: [number, number, number] = [245, 245, 243]; // #f5f5f3
const PDF_FG2: [number, number, number] = [181, 181, 178]; // #b5b5b2
const PDF_FG3: [number, number, number] = [122, 122, 120]; // #7a7a78

const pdfFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function drawPdfPageBackground(pdf: JsPDFInstance, pageWidth: number, pageHeight: number) {
  pdf.setFillColor(...PDF_BG);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
}

// Wordmark + fecha + línea divisoria: igual en todas las páginas de
// cualquier PDF que generamos. Devuelve el Y de la línea, así el que
// llama sabe desde dónde seguir dibujando contenido debajo.
function drawPdfHeader(pdf: JsPDFInstance, pageWidth: number, margin: number): number {
  const wordmarkY = margin + 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...PDF_FG);
  pdf.text("COOL", margin, wordmarkY);
  const coolWidth = pdf.getTextWidth("COOL");
  pdf.setTextColor(...PDF_ACCENT);
  pdf.text("metrics", margin + coolWidth, wordmarkY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_FG3);
  pdf.text(pdfFecha.format(new Date()), pageWidth - margin, wordmarkY, { align: "right" });

  pdf.setDrawColor(...PDF_LINE);
  pdf.setLineWidth(0.75);
  const dividerY = wordmarkY + 14;
  pdf.line(margin, dividerY, pageWidth - margin, dividerY);
  return dividerY;
}

// Dibuja una página completa (fondo, header, título, tarjeta con la
// imagen capturada, pie de página) — usada por el export de una sola
// respuesta.
function drawPdfReportPage(pdf: JsPDFInstance, question: string, canvas: HTMLCanvasElement) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  drawPdfPageBackground(pdf, pageWidth, pageHeight);
  const dividerY = drawPdfHeader(pdf, pageWidth, margin);

  // Título (la pregunta que generó el reporte).
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...PDF_FG);
  const titleY = dividerY + 30;
  const titleLines: string[] = pdf.splitTextToSize(question, contentWidth);
  pdf.text(titleLines, margin, titleY);

  // Tarjeta con el resumen + gráfico capturado, mismo estilo que las
  // respuestas del chat (fondo --asis-card, borde lima a la izquierda).
  const cardPadding = 14;
  const cardTop = titleY + titleLines.length * 19 + 16;
  const footerHeight = 40;
  const maxCardHeight = pageHeight - margin - footerHeight - cardTop;
  const maxImgWidth = contentWidth - cardPadding * 2;
  const maxImgHeight = maxCardHeight - cardPadding * 2;
  const scale = Math.min(maxImgWidth / canvas.width, maxImgHeight / canvas.height);
  const imgWidth = canvas.width * scale;
  const imgHeight = canvas.height * scale;
  const cardHeight = imgHeight + cardPadding * 2;

  pdf.setFillColor(...PDF_CARD);
  pdf.roundedRect(margin, cardTop, contentWidth, cardHeight, 10, 10, "F");
  pdf.setFillColor(...PDF_ACCENT);
  pdf.rect(margin, cardTop, 3, cardHeight, "F");
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin + cardPadding, cardTop + cardPadding, imgWidth, imgHeight);

  // Pie de página, mismo tagline que el resto del producto.
  const footerY = pageHeight - margin / 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...PDF_FG);
  const footCool = "COOL";
  const footMetrics = "metrics";
  const footSep = "  ·  Client Intelligence Platform";
  pdf.setFont("helvetica", "normal");
  const footSepWidth = pdf.getTextWidth(footSep);
  pdf.setFont("helvetica", "bold");
  const footTotalWidth = pdf.getTextWidth(footCool) + pdf.getTextWidth(footMetrics) + footSepWidth;
  let footX = (pageWidth - footTotalWidth) / 2;
  pdf.setTextColor(...PDF_FG);
  pdf.text(footCool, footX, footerY);
  footX += pdf.getTextWidth(footCool);
  pdf.setTextColor(...PDF_ACCENT);
  pdf.text(footMetrics, footX, footerY);
  footX += pdf.getTextWidth(footMetrics);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...PDF_FG2);
  pdf.text(footSep, footX, footerY);
}

async function exportReportAsPdf(question: string, node: HTMLElement) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const canvas = await html2canvas(node, { backgroundColor: "#27262a", scale: 2 });
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  drawPdfReportPage(pdf, question, canvas);
  pdf.save(`${slugify(question)}.pdf`);
}

// Export de TODA la conversación: las preguntas van una a continuación de
// la otra (sin un salto de página forzado por cada una, como en el export
// individual) — una tarjeta nueva arranca página solo si de verdad no
// entra en el espacio que queda, no porque "le toque" su propia hoja.
async function exportHistoryAsPdf(entries: { question: string; node: HTMLElement }[]) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const cardPadding = 14;
  const blockGap = 22;
  // Tope de alto para que una sola tarjeta nunca sea más grande que una
  // página entera (si la imagen es muy alta, se achica para entrar en una
  // página — no la recortamos entre dos).
  const maxCardHeight = pageHeight - margin * 2;

  let y = margin;
  let started = false;

  function startPage() {
    if (started) pdf.addPage();
    started = true;
    drawPdfPageBackground(pdf, pageWidth, pageHeight);
    const dividerY = drawPdfHeader(pdf, pageWidth, margin);
    y = dividerY + 26;
  }

  startPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...PDF_FG);
  pdf.text("Historial de la conversación", margin, y);
  y += 28;

  for (const { question, node } of entries) {
    const canvas = await html2canvas(node, { backgroundColor: "#27262a", scale: 2 });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    const titleLines: string[] = pdf.splitTextToSize(question, contentWidth);
    const titleHeight = titleLines.length * 16 + 8;

    let imgWidth = contentWidth - cardPadding * 2;
    let imgHeight = canvas.height * (imgWidth / canvas.width);
    const maxImgHeight = maxCardHeight - titleHeight - cardPadding * 2;
    if (imgHeight > maxImgHeight) {
      const scale = maxImgHeight / imgHeight;
      imgHeight *= scale;
      imgWidth *= scale;
    }
    const cardHeight = imgHeight + cardPadding * 2;
    const blockHeight = titleHeight + cardHeight;

    // Si no entra en lo que queda de página, recién ahí pasa a la
    // siguiente — nunca por default.
    if (y + blockHeight > pageHeight - margin) {
      startPage();
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...PDF_FG);
    pdf.text(titleLines, margin, y + 12);

    const cardTop = y + titleHeight;
    pdf.setFillColor(...PDF_CARD);
    pdf.roundedRect(margin, cardTop, contentWidth, cardHeight, 10, 10, "F");
    pdf.setFillColor(...PDF_ACCENT);
    pdf.rect(margin, cardTop, 3, cardHeight, "F");
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin + cardPadding, cardTop + cardPadding, imgWidth, imgHeight);

    y = cardTop + cardHeight + blockGap;
  }

  pdf.save(`coolmetrics-historial-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function SaveButton({ state, onSave, onUnsave }: { state: SaveState; onSave: () => void; onUnsave: () => void }) {
  if (state === "saved") {
    return (
      <button type="button" className="asis-save asis-save-done" onClick={onUnsave} title="Eliminar guardado">
        <span className="asis-save-done-default">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Guardado
        </span>
        <span className="asis-save-done-hover">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Eliminar
        </span>
      </button>
    );
  }
  if (state === "deleting") {
    return (
      <span className="asis-save asis-save-done" style={{ opacity: 0.6 }}>
        Eliminando…
      </span>
    );
  }
  return (
    <button type="button" className="asis-save" onClick={onSave} disabled={state === "saving"}>
      {state === "saving" ? "Guardando…" : "Guardar"}
    </button>
  );
}

function AssistantBubble({
  question,
  report,
  saveState,
  onSave,
  onUnsave,
}: {
  question: string;
  report: AssistantReport;
  saveState: SaveState;
  onSave: () => void;
  onUnsave: () => void;
}) {
  const [chart, setChart] = useState(report.chart);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  async function downloadPdf() {
    if (!exportRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportReportAsPdf(question, exportRef.current);
    } catch (error) {
      console.error("No se pudo exportar el PDF", error);
    } finally {
      setExportingPdf(false);
    }
  }

  function downloadCsv() {
    if (!chart?.rows.length) return;
    downloadBlob(`${slugify(question)}.csv`, rowsToCsv(chart.rows), "text/csv;charset=utf-8");
  }

  async function rerun() {
    if (!report.sql || rerunning) return;
    setRerunning(true);
    setRerunError("");
    try {
      const res = await fetch("/api/asistente/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: report.sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRerunError(data.error ?? "No se pudo actualizar.");
        return;
      }
      setChart((c) => (c ? { ...c, rows: data.rows } : c));
    } catch (error) {
      setRerunError(error instanceof Error ? error.message : String(error));
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="asis-bubble asis-bubble-assistant">
      <AsisAvatar />
      <div className="asis-bubble-body">
        <div ref={exportRef} className="asis-exportable">
          <p className="asis-summary">{report.summary}</p>
          {chart && <Chart chart={chart} />}
        </div>
        {rerunError && <p className="asis-empty">Error al actualizar: {rerunError}</p>}
        <div className="asis-bubble-foot">
          <div className="asis-bubble-actions">
            {report.sql && (
              <button type="button" className="asis-save" onClick={rerun} disabled={rerunning}>
                {rerunning ? "Actualizando…" : "Volver a ejecutar"}
              </button>
            )}
            <button type="button" className="asis-save" onClick={downloadPdf} disabled={exportingPdf}>
              {exportingPdf ? "Generando…" : "PDF"}
            </button>
            {!!chart?.rows.length && (
              <button type="button" className="asis-save" onClick={downloadCsv}>
                Excel
              </button>
            )}
            <SaveButton state={saveState} onSave={onSave} onUnsave={onUnsave} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AsistenteChat({
  fontClassName,
  userId,
  token,
  initialSaved,
  initialTurns,
}: {
  fontClassName: string;
  userId: string | null;
  token: string | null;
  initialSaved: SavedReport[];
  initialTurns?: ChatTurn[];
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedList, setSavedList] = useState<SavedReport[]>(initialSaved);
  const [exportingHistory, setExportingHistory] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const assistantTurns = turns.filter(
    (t): t is Extract<ChatTurn, { role: "assistant" }> => t.role === "assistant",
  );

  // Exportar TODA la conversación (no solo una respuesta) para armar un
  // reporte para llevar a una reunión. Los nodos .asis-exportable aparecen
  // en el DOM en el mismo orden que assistantTurns, así que los zippeamos
  // por índice en vez de necesitar un ref por burbuja.
  async function downloadHistoryPdf() {
    if (!rootRef.current || !assistantTurns.length || exportingHistory) return;
    setExportingHistory(true);
    try {
      const nodes = Array.from(rootRef.current.querySelectorAll<HTMLElement>(".asis-exportable"));
      const entries = assistantTurns
        .map((t, i) => ({ question: t.question, node: nodes[i] }))
        .filter((e): e is { question: string; node: HTMLElement } => !!e.node);
      if (entries.length) await exportHistoryAsPdf(entries);
    } catch (error) {
      console.error("No se pudo exportar el historial a PDF", error);
    } finally {
      setExportingHistory(false);
    }
  }


  // Avisamos a Softr el alto UNA sola vez, al montar, y siempre el mismo
  // valor fijo — nunca volvemos a avisar un alto distinto, sin importar
  // cuánto crezca la conversación (eso queda contenido adentro de .asis,
  // ver asistente.css). Antes el iframe crecía con cada mensaje: resultó
  // que el sidebar sticky de Softr se rompía apenas el iframe cambiaba de
  // alto una vez cargada la página, sin importar cuánto creciera. Con el
  // alto fijo de entrada, la página de Softr nunca vuelve a redimensionarse
  // por nuestra culpa.
  useEffect(() => {
    window.parent.postMessage({ source: "coolmetrics-report", height: FRAME_HEIGHT }, "*");
  }, []);

  // El scroll del mouse sobre el iframe se reenvía a Softr para que la
  // página real se mueva — pero solo cuando .asis ya no tiene margen para
  // scrollear internamente en esa dirección. Reenviarlo siempre, aun
  // cuando .asis también scrollea de forma nativa por haber pasado el
  // tope, hacía que ambos scrolls pasaran a la vez: ese salto doble era
  // lo que rompía el sidebar sticky de Softr en respuestas largas.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
      window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Con cada mensaje nuevo bajamos el scroll interno de .asis al final —
  // si la conversación todavía entra en los FRAME_HEIGHT px fijos, esto no
  // hace nada visible.
  useEffect(() => {
    const el = rootRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  async function saveTurn(index: number) {
    const turn = turns[index];
    if (turn.role !== "assistant") return;

    setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "saving" } : t)));

    try {
      const res = await fetch("/api/asistente/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          question: turn.question,
          summary: turn.report.summary,
          sql: turn.report.sql,
          chart: turn.report.chart,
        }),
      });
      const data = await res.json();
      setTurns((prev) =>
        prev.map((t, i) =>
          i === index && t.role === "assistant"
            ? { ...t, saveState: res.ok ? "saved" : "error", savedId: res.ok ? (data as SavedReport).id : null }
            : t,
        ),
      );
      if (res.ok) {
        setSavedList((prev) => [data as SavedReport, ...prev]);
      }
    } catch {
      setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "error" } : t)));
    }
  }

  async function unsaveTurn(index: number) {
    const turn = turns[index];
    if (turn.role !== "assistant" || !turn.savedId) return;
    const id = turn.savedId;

    setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "deleting" } : t)));

    try {
      const res = await fetch("/api/asistente/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId }),
      });
      if (!res.ok) {
        setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "saved" } : t)));
        return;
      }
      setTurns((prev) =>
        prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "idle", savedId: null } : t)),
      );
      setSavedList((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "saved" } : t)));
    }
  }

  // Si el mismo guardado se borra desde el panel de la derecha, el bubble
  // del chat que lo tenía como "Guardado" tiene que volver a "Guardar" —
  // si no, quedaría ofreciendo "Eliminar" un guardado que ya no existe.
  function dropSavedId(id: string) {
    setTurns((prev) =>
      prev.map((t) => (t.role === "assistant" && t.savedId === id ? { ...t, saveState: "idle", savedId: null } : t)),
    );
  }

  async function deleteFromSidebar(id: string) {
    const removed = savedList.find((r) => r.id === id);
    setSavedList((prev) => prev.filter((r) => r.id !== id));
    dropSavedId(id);
    try {
      const res = await fetch("/api/asistente/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId }),
      });
      // No pudimos confirmar el borrado en el servidor — lo mostramos de
      // nuevo en vez de dejar al usuario pensando que se borró.
      if (!res.ok && removed) {
        setSavedList((prev) => [removed, ...prev]);
      }
    } catch {
      if (removed) setSavedList((prev) => [removed, ...prev]);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setLoading(true);

    const history = nextTurns.map((t) =>
      t.role === "user"
        ? { role: "user" as const, content: t.content }
        : t.role === "assistant"
          ? { role: "assistant" as const, content: t.report.summary }
          : { role: "assistant" as const, content: t.message },
    );

    try {
      const res = await fetch("/api/asistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, email: userId, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns((prev) => [...prev, { role: "assistant-error", message: data.error ?? "Error desconocido." }]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", question: text, report: data as AssistantReport, saveState: "idle", savedId: null },
        ]);
      }
    } catch (error) {
      setTurns((prev) => [
        ...prev,
        { role: "assistant-error", message: error instanceof Error ? error.message : String(error) },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const suggestions = [
    { text: "¿Cómo vienen las sesiones este mes contra el anterior?", k: "k1" },
    { text: "Facturación por canal del último trimestre", k: "k2" },
    { text: "¿Cuántos influencers tengo activos?", k: "k4" },
  ] as const;

  return (
    <div className={`asis ${fontClassName}`} ref={rootRef}>
      <AsistenteHeader savedCount={savedList.length} />
      <div className="asis-layout">
      <div className="asis-wrap">
        {assistantTurns.length > 0 && (
          <div className="asis-history-bar">
            <span className="asis-history-label">Exportar toda la conversación:</span>
            <button type="button" className="asis-save" onClick={downloadHistoryPdf} disabled={exportingHistory}>
              {exportingHistory ? "Generando…" : "PDF"}
            </button>
          </div>
        )}

        <div className="asis-thread">
          {turns.length === 0 && (
            <div className="asis-hint">
              <p>Probá algo como:</p>
              <div className="asis-suggestions">
                {suggestions.map((s) => (
                  <button key={s.text} type="button" className={`asis-sugg-${s.k}`} onClick={() => setInput(s.text)}>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="asis-bubble asis-bubble-user">
                {t.content}
              </div>
            ) : t.role === "assistant" ? (
              <AssistantBubble
                key={i}
                question={t.question}
                report={t.report}
                saveState={t.saveState}
                onSave={() => saveTurn(i)}
                onUnsave={() => unsaveTurn(i)}
              />
            ) : (
              <div key={i} className="asis-bubble asis-bubble-error">
                {t.message}
              </div>
            ),
          )}
          {loading && (
            <div className="asis-bubble asis-bubble-assistant asis-thinking">
              <AsisAvatar />
              <span className="asis-dot asis-dot-1" />
              <span className="asis-dot asis-dot-2" />
              <span className="asis-dot asis-dot-3" />
            </div>
          )}
        </div>

        <form
          className="asis-form"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escribí tu pregunta…"
            rows={1}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Enviar
          </button>
        </form>
      </div>

      <aside className="asis-sidebar">
        <h2>Mis guardados</h2>
        {!userId && <p className="asis-empty">Entrá desde el portal para guardar reportes.</p>}
        {userId && savedList.length === 0 && <p className="asis-empty">Todavía no guardaste ningún reporte.</p>}
        {savedList.map((r, i) => (
          <div key={r.id} className={`asis-sidebar-item asis-sidebar-item-${SIDEBAR_COLORS[i % SIDEBAR_COLORS.length]}`}>
            <a
              className="asis-sidebar-item-link"
              href={`/asistente/guardados/${r.id}?u=${encodeURIComponent(userId ?? "")}&t=${encodeURIComponent(token ?? "")}`}
            >
              <span className="asis-sidebar-item-q">{r.question}</span>
              <span className="asis-sidebar-item-d">{sidebarFecha.format(new Date(r.created_at))}</span>
            </a>
            <button
              type="button"
              className="asis-sidebar-item-del"
              title="Eliminar guardado"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteFromSidebar(r.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {userId && savedList.length > 0 && (
          <a className="asis-saved-link" href={`/asistente/guardados?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token ?? "")}`}>
            Ver todos →
          </a>
        )}
      </aside>
      </div>
    </div>
  );
}
