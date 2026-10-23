"use client";

import { useEffect, useRef, useState } from "react";
import "./asistente.css";
import { Chart, AsisAvatar, type ChartSpec } from "./ReportChart";
import { AsistenteHeader } from "./AsistenteHeader";
import type { SavedReport } from "@/lib/assistant/savedReports";

type AssistantReport = { summary: string; sql: string; chart: ChartSpec | null };

type SaveState = "idle" | "saving" | "saved" | "error";

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; question: string; report: AssistantReport; saveState: SaveState }
  | { role: "assistant-error"; message: string };

// Alto fijo del iframe embebido en Softr, en píxeles — se reporta UNA sola
// vez al montar y nunca cambia, así el iframe nunca vuelve a redimensionar
// la página de Softr (ver el comentario sobre por qué en el useEffect de
// abajo). Tiene que ser el mismo valor que .asis { height } en asistente.css.
const FRAME_HEIGHT = 880;

const sidebarFecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

function SaveButton({ state, onSave }: { state: SaveState; onSave: () => void }) {
  if (state === "saved") {
    return (
      <span className="asis-save asis-save-done">
        <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Guardado
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
  report,
  saveState,
  onSave,
}: {
  report: AssistantReport;
  saveState: SaveState;
  onSave: () => void;
}) {
  const [chart, setChart] = useState(report.chart);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState("");

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
        <p className="asis-summary">{report.summary}</p>
        {chart && <Chart chart={chart} />}
        {rerunError && <p className="asis-empty">Error al actualizar: {rerunError}</p>}
        <div className="asis-bubble-foot">
          {report.sql && (
            <details className="asis-sql">
              <summary>Ver el SQL</summary>
              <pre>{report.sql}</pre>
            </details>
          )}
          <div className="asis-bubble-actions">
            {report.sql && (
              <button type="button" className="asis-save" onClick={rerun} disabled={rerunning}>
                {rerunning ? "Actualizando…" : "Volver a ejecutar"}
              </button>
            )}
            <SaveButton state={saveState} onSave={onSave} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AsistenteChat({
  fontClassName,
  userId,
  initialSaved,
  initialTurns,
}: {
  fontClassName: string;
  userId: string | null;
  initialSaved: SavedReport[];
  initialTurns?: ChatTurn[];
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedList, setSavedList] = useState<SavedReport[]>(initialSaved);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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
        prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: res.ok ? "saved" : "error" } : t)),
      );
      if (res.ok) {
        setSavedList((prev) => [data as SavedReport, ...prev]);
      }
    } catch {
      setTurns((prev) => prev.map((t, i) => (i === index && t.role === "assistant" ? { ...t, saveState: "error" } : t)));
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
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns((prev) => [...prev, { role: "assistant-error", message: data.error ?? "Error desconocido." }]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", question: text, report: data as AssistantReport, saveState: "idle" },
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
    { text: "¿Cuántos influencers tengo activos?", k: "k3" },
  ] as const;

  return (
    <div className={`asis ${fontClassName}`} ref={rootRef}>
      <div className="asis-layout">
      <div className="asis-wrap">
        <AsistenteHeader />

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
              <AssistantBubble key={i} report={t.report} saveState={t.saveState} onSave={() => saveTurn(i)} />
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
        {savedList.map((r) => (
          <a
            key={r.id}
            className="asis-sidebar-item"
            href={`/asistente/guardados/${r.id}?u=${encodeURIComponent(userId ?? "")}`}
          >
            <span className="asis-sidebar-item-q">{r.question}</span>
            <span className="asis-sidebar-item-d">{sidebarFecha.format(new Date(r.created_at))}</span>
          </a>
        ))}
        {userId && savedList.length > 0 && (
          <a className="asis-saved-link" href={`/asistente/guardados?u=${encodeURIComponent(userId)}`}>
            Ver todos →
          </a>
        )}
      </aside>
      </div>
    </div>
  );
}
