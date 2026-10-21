"use client";

import { useEffect, useRef, useState } from "react";
import "./asistente.css";

type ChartSpec = {
  type: "kpi" | "table" | "bar" | "line";
  title: string;
  rows: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  valueKey?: string;
  valueLabel?: string;
};

type AssistantReport = { summary: string; sql: string; chart: ChartSpec | null };

type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; report: AssistantReport }
  | { role: "assistant-error"; message: string };

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function fmtValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return nf.format(v);
  return String(v);
}

function Kpi({ chart }: { chart: ChartSpec }) {
  const row = chart.rows[0];
  if (!row) return <p className="asis-empty">Sin datos.</p>;
  const key = chart.valueKey ?? Object.keys(row)[0];
  return (
    <div className="asis-kpi">
      <div className="asis-kpi-v">{fmtValue(row[key])}</div>
      <div className="asis-kpi-l">{chart.valueLabel ?? chart.title}</div>
    </div>
  );
}

function Table({ chart }: { chart: ChartSpec }) {
  if (!chart.rows.length) return <p className="asis-empty">Sin datos.</p>;
  const columns = Object.keys(chart.rows[0]);
  return (
    <div className="asis-table-wrap">
      <table className="asis-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{fmtValue(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarChart({ chart }: { chart: ChartSpec }) {
  const xKey = chart.xKey ?? Object.keys(chart.rows[0] ?? {})[0];
  const yKey = chart.yKey ?? Object.keys(chart.rows[0] ?? {})[1];
  if (!chart.rows.length || !xKey || !yKey) return <p className="asis-empty">Sin datos.</p>;
  const values = chart.rows.map((r) => Number(r[yKey]) || 0);
  const max = Math.max(1, ...values);
  const w = 640,
    h = 220,
    pad = 28,
    barGap = 6;
  const barW = (w - pad * 2) / chart.rows.length - barGap;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {chart.rows.map((r, i) => {
        const v = Number(r[yKey]) || 0;
        const bh = ((h - pad * 2) * v) / max;
        const x = pad + i * ((w - pad * 2) / chart.rows.length);
        const y = h - pad - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={Math.max(2, barW)} height={bh} fill="var(--asis-accent)" rx={2} />
            <text x={x + barW / 2} y={h - pad + 14} textAnchor="middle" fontSize={9} fill="var(--asis-fg2)">
              {String(r[xKey]).slice(0, 10)}
            </text>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--asis-fg)">
              {nf.format(v)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ chart }: { chart: ChartSpec }) {
  const xKey = chart.xKey ?? Object.keys(chart.rows[0] ?? {})[0];
  const yKey = chart.yKey ?? Object.keys(chart.rows[0] ?? {})[1];
  if (!chart.rows.length || !xKey || !yKey) return <p className="asis-empty">Sin datos.</p>;
  const values = chart.rows.map((r) => Number(r[yKey]) || 0);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const w = 640,
    h = 220,
    pad = 28;
  const span = max - min || 1;
  const points = chart.rows.map((r, i) => {
    const v = Number(r[yKey]) || 0;
    const x = pad + (i * (w - pad * 2)) / Math.max(1, chart.rows.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline fill="none" stroke="var(--asis-accent)" strokeWidth={2} points={points.map((p) => p.join(",")).join(" ")} />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill="var(--asis-accent)" />
      ))}
      <text x={pad} y={h - 6} fontSize={9} fill="var(--asis-fg2)">
        {String(chart.rows[0][xKey]).slice(0, 10)}
      </text>
      <text x={w - pad} y={h - 6} fontSize={9} fill="var(--asis-fg2)" textAnchor="end">
        {String(chart.rows[chart.rows.length - 1][xKey]).slice(0, 10)}
      </text>
    </svg>
  );
}

function Chart({ chart }: { chart: ChartSpec }) {
  return (
    <div className="asis-chart">
      <h3>{chart.title}</h3>
      {chart.type === "kpi" && <Kpi chart={chart} />}
      {chart.type === "table" && <Table chart={chart} />}
      {chart.type === "bar" && <BarChart chart={chart} />}
      {chart.type === "line" && <LineChart chart={chart} />}
    </div>
  );
}

function AssistantBubble({ report }: { report: AssistantReport }) {
  return (
    <div className="asis-bubble asis-bubble-assistant">
      <p className="asis-summary">{report.summary}</p>
      {report.chart && <Chart chart={report.chart} />}
      {report.sql && (
        <details className="asis-sql">
          <summary>Ver el SQL</summary>
          <pre>{report.sql}</pre>
        </details>
      )}
    </div>
  );
}

export default function AsistenteChat({ fontClassName }: { fontClassName: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Avisa al padre (Softr) el alto real del contenido para que el iframe se
  // ajuste solo — la conversación crece con cada pregunta, a diferencia de
  // los dashboards que tienen un alto fijo una vez cargados los datos.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const post = () => window.parent.postMessage({ source: "coolmetrics-report", height: el.scrollHeight }, "*");
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [turns, loading]);

  // El scroll del mouse sobre el iframe no se propaga solo al documento
  // padre — se reenvía como mensaje para que Softr haga scroll de la página.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

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
        setTurns((prev) => [...prev, { role: "assistant", report: data as AssistantReport }]);
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
      <div className="asis-wrap">
        <header className="asis-head">
          <div className="asis-head-top">
            <span className="asis-spark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="asis-kicker">Coolmetrics</span>
          </div>
          <h1>Asistente de datos</h1>
          <p className="asis-tagline">Sin Power BI, sin vueltas: preguntá y listo.</p>
          <p>Le preguntás por los datos de Decathlon, él arma el gráfico y te muestra el SQL que usó.</p>
        </header>

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
              <AssistantBubble key={i} report={t.report} />
            ) : (
              <div key={i} className="asis-bubble asis-bubble-error">
                {t.message}
              </div>
            ),
          )}
          {loading && (
            <div className="asis-bubble asis-bubble-assistant asis-thinking">
              <span className="asis-dot" />
              <span className="asis-dot" />
              <span className="asis-dot" />
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
    </div>
  );
}
