"use client";

// Compartido entre el chat (AsistenteChat) y la galería de guardados
// (guardados/page.tsx) — un reporte se dibuja igual se lo vea recién
// generado o recuperado de la base.

export type ChartSpec = {
  type: "kpi" | "table" | "bar" | "line";
  title: string;
  rows: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  valueKey?: string;
  valueLabel?: string;
};

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

// Paleta cíclica para comparar categorías (canales, meses, etc.) — la misma
// idea que ya usan los gráficos de Growth/Influencers, para que un gráfico
// de barras no sea todo de un solo color.
const CHART_COLORS = ["var(--asis-accent)", "var(--asis-k1)", "var(--asis-k2)", "var(--asis-k3)"];

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
            <rect x={x} y={y} width={Math.max(2, barW)} height={bh} fill={CHART_COLORS[i % CHART_COLORS.length]} rx={2} />
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

export function Chart({ chart }: { chart: ChartSpec }) {
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

export function AsisAvatar() {
  return (
    <span className="asis-avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" fill="currentColor" />
      </svg>
    </span>
  );
}
