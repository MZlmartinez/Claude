"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CanalDiaRow,
  CanalRow,
  DispositivoRow,
  MensualRow,
  NegocioDiaRow,
  ProductoDiaRow,
  TraficoRow,
  TraficoDiaRow,
} from "@/lib/reports/growth";
import { F, D, isNum } from "./format";
import "./growth.css";

type Props = {
  canalDia: CanalDiaRow[];
  canales: CanalRow[];
  dispositivo: DispositivoRow[];
  mensual: MensualRow[];
  negocioDia: NegocioDiaRow[];
  productoDia: ProductoDiaRow[];
  trafico: TraficoRow[];
  traficoDia: TraficoDiaRow[];
  fontClassName: string;
};

// ---------- utilidades numéricas (ejes / grillas, calcadas de Influencers) ----------
function niceStep(rough: number) {
  if (!isFinite(rough) || rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  return niceFrac * pow;
}
function ticks(max: number, count: number): number[] {
  if (!isFinite(max) || max <= 0) return [0];
  const step = niceStep(max / count);
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.5; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
function pctAbs(v: number) {
  return Math.abs(v * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}
function pctNeg(v: number | null | undefined) {
  return isNum(v) ? "−" + pctAbs(v) : "—";
}

// Mismo día, un mes antes — como EDATE(fecha, -1) del Power BI original: el
// 31 de marzo cae en el 28 de febrero.
function edate(d: string): string {
  const y = +d.slice(0, 4),
    m = +d.slice(5, 7),
    dd = +d.slice(8, 10);
  const py = m === 1 ? y - 1 : y,
    pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return py + "-" + String(pm).padStart(2, "0") + "-" + String(Math.min(dd, last)).padStart(2, "0");
}

// ---------- datasets derivados (calcados 1:1 de los dash.calc del artifact original) ----------
type EmbudoRow = { mes: string; orden: number; paso: string; sesiones: number | null; caida: number | null };
function calcEmbudo(mensual: MensualRow[]): EmbudoRow[] {
  return mensual.flatMap((r) => {
    const pasos: [string, number | null][] = [
      ["Sesiones", r.sesiones_embudo],
      ["Carrito", r.carrito],
      ["Checkout", r.checkout],
      ["Compra", r.compras],
    ];
    return pasos.map(([paso, v], i) => {
      const prev = i ? pasos[i - 1][1] : null;
      const pasa = i && isNum(prev) && isNum(v) ? (v as number) / (prev as number) : null;
      return { mes: r.mes, orden: i + 1, paso, sesiones: v, caida: pasa == null ? null : 1 - pasa };
    });
  });
}

type TraficoRangoRow = {
  mes: string;
  desde: string;
  hasta: string;
  ant_desde: string;
  ant_hasta: string;
  dias: number;
  dias_ant: number;
  sesiones: number;
  sesiones_ant: number | null;
  var_sesiones: number | null;
  share_pago: number | null;
  dif_share_pago: number | null;
  share_organico: number | null;
  dif_share_organico: number | null;
  rebote: number | null;
  var_rebote: number | null;
  sesiones_diarias: number | null;
  var_sesiones_diarias: number | null;
  sesiones_mobile: number;
  sesiones_desktop: number;
  sesiones_otro_dispositivo: number;
  clientes_nuevos: number;
  var_clientes_nuevos: number | null;
  clientes_recurrentes: number;
  var_clientes_recurrentes: number | null;
};

function calcTraficoRango(traficoDia: TraficoDiaRow[]): TraficoRangoRow[] {
  const rows = [...traficoDia].sort((a, b) => (a.dia < b.dia ? -1 : 1));
  const K = [
    "sesiones",
    "sesiones_organico",
    "sesiones_pago",
    "sesiones_mobile",
    "sesiones_desktop",
    "sesiones_otro_dispositivo",
    "rebotes",
    "clientes_nuevos",
    "clientes_recurrentes",
  ] as const;
  const pre: Record<string, number[]> = {};
  K.forEach((k) => {
    const p = [0];
    rows.forEach((r) => p.push(p[p.length - 1] + (Number(r[k]) || 0)));
    pre[k] = p;
  });
  const lb = (d: string) => {
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].dia < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const ub = (d: string) => {
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].dia <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const tot = (a: string, b: string) => {
    const i = lb(a),
      j = ub(b);
    const out: Record<string, number> = { dias: Math.max(0, j - i) };
    K.forEach((k) => {
      out[k] = j > i ? pre[k][j] - pre[k][i] : 0;
    });
    return out;
  };
  const div = (a: number, b: number) => (b ? a / b : null);
  const rel = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b - 1);
  const dif = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  const meses: Record<string, string[]> = {};
  rows.forEach((r) => {
    (meses[r.mes] = meses[r.mes] || []).push(r.dia);
  });
  const out: TraficoRangoRow[] = [];
  Object.entries(meses).forEach(([mes, dias]) => {
    for (let i = 0; i < dias.length; i++)
      for (let j = i; j < dias.length; j++) {
        const desde = dias[i],
          hasta = dias[j],
          ad = edate(desde),
          ah = edate(hasta);
        const c = tot(desde, hasta),
          a = tot(ad, ah),
          hayAnt = a.dias > 0;
        const sp = div(c.sesiones_pago, c.sesiones),
          so = div(c.sesiones_organico, c.sesiones),
          rb = div(c.rebotes, c.sesiones);
        const spa = hayAnt ? div(a.sesiones_pago, a.sesiones) : null,
          soa = hayAnt ? div(a.sesiones_organico, a.sesiones) : null,
          rba = hayAnt ? div(a.rebotes, a.sesiones) : null;
        const sd = div(c.sesiones, c.dias),
          sda = hayAnt ? div(a.sesiones, a.dias) : null;
        out.push({
          mes,
          desde,
          hasta,
          ant_desde: ad,
          ant_hasta: ah,
          dias: c.dias,
          dias_ant: a.dias,
          sesiones: c.sesiones,
          sesiones_ant: hayAnt ? a.sesiones : null,
          var_sesiones: hayAnt ? rel(c.sesiones, a.sesiones) : null,
          share_pago: sp,
          dif_share_pago: dif(sp, spa),
          share_organico: so,
          dif_share_organico: dif(so, soa),
          rebote: rb,
          var_rebote: rel(rb, rba),
          sesiones_diarias: sd,
          var_sesiones_diarias: rel(sd, sda),
          sesiones_mobile: c.sesiones_mobile,
          sesiones_desktop: c.sesiones_desktop,
          sesiones_otro_dispositivo: c.sesiones_otro_dispositivo,
          clientes_nuevos: c.clientes_nuevos,
          var_clientes_nuevos: hayAnt ? rel(c.clientes_nuevos, a.clientes_nuevos) : null,
          clientes_recurrentes: c.clientes_recurrentes,
          var_clientes_recurrentes: hayAnt ? rel(c.clientes_recurrentes, a.clientes_recurrentes) : null,
        });
      }
  });
  return out;
}

type NegocioRangoRow = {
  mes: string;
  desde: string;
  hasta: string;
  ant_desde: string;
  ant_hasta: string;
  dias: number;
  dias_ant: number;
  fact_sin_iva: number;
  fact_con_iva: number;
  fact_sin_iva_ant: number | null;
  var_fact: number | null;
  ordenes: number;
  ordenes_ant: number | null;
  var_ordenes: number | null;
  ticket_sin_iva: number | null;
  var_ticket: number | null;
  fact_nuevos_sin_iva: number;
  fact_recurrentes_sin_iva: number;
};

function calcNegocioRango(negocioDia: NegocioDiaRow[]): NegocioRangoRow[] {
  const rows = [...negocioDia].sort((a, b) => (a.dia < b.dia ? -1 : 1));
  const K = [
    "fact_con_iva",
    "fact_sin_iva",
    "fact_nuevos_sin_iva",
    "fact_recurrentes_sin_iva",
    "ordenes",
    "neto_ticket_con_iva",
    "ordenes_ticket",
  ] as const;
  const pre: Record<string, number[]> = {};
  K.forEach((k) => {
    const p = [0];
    rows.forEach((r) => p.push(p[p.length - 1] + (Number(r[k]) || 0)));
    pre[k] = p;
  });
  const lb = (d: string) => {
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].dia < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const ub = (d: string) => {
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].dia <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const tot = (a: string, b: string) => {
    const i = lb(a),
      j = ub(b);
    const out: Record<string, number> = { dias: Math.max(0, j - i) };
    K.forEach((k) => {
      out[k] = j > i ? pre[k][j] - pre[k][i] : 0;
    });
    return out;
  };
  const rel = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b - 1);
  const meses: Record<string, string[]> = {};
  rows.forEach((r) => {
    (meses[r.mes] = meses[r.mes] || []).push(r.dia);
  });
  const out: NegocioRangoRow[] = [];
  Object.entries(meses).forEach(([mes, dias]) => {
    for (let i = 0; i < dias.length; i++)
      for (let j = i; j < dias.length; j++) {
        const desde = dias[i],
          hasta = dias[j],
          ad = edate(desde),
          ah = edate(hasta);
        const c = tot(desde, hasta),
          a = tot(ad, ah),
          hay = a.dias > 0;
        const tk = c.ordenes_ticket ? c.neto_ticket_con_iva / c.ordenes_ticket : null;
        const tka = hay && a.ordenes_ticket ? a.neto_ticket_con_iva / a.ordenes_ticket : null;
        out.push({
          mes,
          desde,
          hasta,
          ant_desde: ad,
          ant_hasta: ah,
          dias: c.dias,
          dias_ant: a.dias,
          fact_sin_iva: c.fact_sin_iva,
          fact_con_iva: c.fact_con_iva,
          fact_sin_iva_ant: hay ? a.fact_sin_iva : null,
          var_fact: hay ? rel(c.fact_sin_iva, a.fact_sin_iva) : null,
          ordenes: c.ordenes,
          ordenes_ant: hay ? a.ordenes : null,
          var_ordenes: hay ? rel(c.ordenes, a.ordenes) : null,
          ticket_sin_iva: tk == null ? null : tk / 1.21,
          var_ticket: rel(tk, tka),
          fact_nuevos_sin_iva: c.fact_nuevos_sin_iva,
          fact_recurrentes_sin_iva: c.fact_recurrentes_sin_iva,
        });
      }
  });
  return out;
}

type ProductoRangoRow = { mes: string; desde: string; hasta: string; tipo: string; fact_sin_iva: number; unidades: number };

function calcProductosRango(productoDia: ProductoDiaRow[]): ProductoRangoRow[] {
  const dias = [...new Set(productoDia.map((r) => r.dia))].sort();
  const pos = new Map(dias.map((d, i) => [d, i]));
  const tipos = [...new Set(productoDia.map((r) => r.tipo))];
  const serie = Object.fromEntries(
    tipos.map((t) => [t, { f: new Array(dias.length).fill(0), u: new Array(dias.length).fill(0) }]),
  );
  productoDia.forEach((r) => {
    const i = pos.get(r.dia)!;
    serie[r.tipo].f[i] += Number(r.fact_sin_iva) || 0;
    serie[r.tipo].u[i] += Number(r.unidades) || 0;
  });
  const acc = (v: number[]) => {
    const p = [0];
    v.forEach((x) => p.push(p[p.length - 1] + x));
    return p;
  };
  const pre = Object.fromEntries(tipos.map((t) => [t, { f: acc(serie[t].f), u: acc(serie[t].u) }]));
  const lb = (d: string) => {
    let lo = 0,
      hi = dias.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dias[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const ub = (d: string) => {
    let lo = 0,
      hi = dias.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dias[mid] <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const meses: Record<string, string[]> = {};
  dias.forEach((d) => {
    (meses[d.slice(0, 7)] = meses[d.slice(0, 7)] || []).push(d);
  });
  const out: ProductoRangoRow[] = [];
  Object.entries(meses).forEach(([mes, ds]) => {
    for (let i = 0; i < ds.length; i++)
      for (let j = i; j < ds.length; j++) {
        const a = lb(ds[i]),
          b = ub(ds[j]);
        tipos.forEach((t) => {
          const f = pre[t].f[b] - pre[t].f[a],
            u = pre[t].u[b] - pre[t].u[a];
          if (f || u) out.push({ mes, desde: ds[i], hasta: ds[j], tipo: t, fact_sin_iva: f, unidades: u });
        });
      }
  });
  return out;
}

type CanalRangoRow = {
  mes: string;
  desde: string;
  hasta: string;
  canal: string;
  sesiones: number;
  sesiones_ant: number | null;
  share: number | null;
  dif_share: number | null;
};

function calcCanalesRango(canalDia: CanalDiaRow[]): CanalRangoRow[] {
  const dias = [...new Set(canalDia.map((r) => r.dia))].sort();
  const pos = new Map(dias.map((d, i) => [d, i]));
  const canales = [...new Set(canalDia.map((r) => r.canal))];
  const serie = Object.fromEntries([...canales, "__total"].map((c) => [c, new Array(dias.length).fill(0)]));
  canalDia.forEach((r) => {
    const i = pos.get(r.dia)!;
    serie[r.canal][i] += Number(r.sesiones) || 0;
    serie.__total[i] += Number(r.sesiones) || 0;
  });
  const pre = Object.fromEntries(
    Object.entries(serie).map(([c, v]) => {
      const p = [0];
      (v as number[]).forEach((x) => p.push(p[p.length - 1] + x));
      return [c, p];
    }),
  );
  const lb = (d: string) => {
    let lo = 0,
      hi = dias.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dias[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const ub = (d: string) => {
    let lo = 0,
      hi = dias.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dias[mid] <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const sum = (c: string, a: string, b: string) => {
    const i = lb(a),
      j = ub(b);
    return j > i ? pre[c][j] - pre[c][i] : 0;
  };
  const meses: Record<string, string[]> = {};
  dias.forEach((d) => {
    (meses[d.slice(0, 7)] = meses[d.slice(0, 7)] || []).push(d);
  });
  const out: CanalRangoRow[] = [];
  Object.entries(meses).forEach(([mes, ds]) => {
    for (let i = 0; i < ds.length; i++)
      for (let j = i; j < ds.length; j++) {
        const desde = ds[i],
          hasta = ds[j],
          ad = edate(desde),
          ah = edate(hasta);
        const t = sum("__total", desde, hasta),
          ta = sum("__total", ad, ah);
        canales.forEach((c) => {
          const s = sum(c, desde, hasta),
            sa = sum(c, ad, ah);
          if (!s && !sa) return;
          const sh = t ? s / t : null,
            sha = ta ? sa / ta : null;
          out.push({ mes, desde, hasta, canal: c, sesiones: s, sesiones_ant: ta ? sa : null, share: sh, dif_share: sh == null || sha == null ? null : sh - sha });
        });
      }
  });
  return out;
}

// ---------- primitivas visuales ----------
function Delta({ value, fmt, invert, neutral, note, hero }: { value: number | null | undefined; fmt: (v: number) => string; invert?: boolean; neutral?: boolean; note: string; hero?: boolean }) {
  const cls = neutral || !isNum(value) || value === 0 ? "flat" : (value! > 0) !== !!invert ? "up" : "down";
  return (
    <div className={hero ? "mx-kpi-s" : "mx-tile-s"}>
      <span className={`mx-delta ${cls}`}>{isNum(value) ? fmt(value!) : "—"}</span>{" "}
      <span className="mx-delta-note">{note}</span>
    </div>
  );
}

function KpiTile({ hero, label, value, children }: { hero?: boolean; label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={hero ? "mx-kpi" : "mx-tile"}>
      <div className={hero ? "mx-kpi-l" : "mx-tile-l"}>{label}</div>
      <div className={hero ? "mx-kpi-v" : "mx-tile-v"}>{value}</div>
      {children}
    </div>
  );
}

function GoalBar({ label, value, fmt, goal }: { label: string; value: number | null | undefined; fmt: (v: number) => string; goal: number | null | undefined }) {
  const hasGoal = isNum(goal) && goal! > 0;
  const ratio = hasGoal && isNum(value) ? value! / goal! : null;
  return (
    <div className="mx-goal">
      <div className="mx-goal-top">
        <span>
          <b>{label} </b>
          {isNum(value) ? fmt(value!) : "—"}
        </span>
        <span>{hasGoal ? <>de {fmt(goal!)} · {Math.round((ratio ?? 0) * 100)} %</> : "Sin objetivo cargado"}</span>
      </div>
      {hasGoal && (
        <div className="mx-goal-track">
          <div className="mx-goal-fill" style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function BarList<T>({
  rows,
  label,
  value,
  fmt,
  color,
  title,
  onClick,
  empty,
}: {
  rows: T[];
  label: (r: T) => string;
  value: (r: T) => number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  color?: (r: T) => string;
  title?: (r: T) => string;
  onClick?: (r: T) => void;
  empty?: string;
}) {
  if (!rows.length) return <div className="mx-empty">{empty ?? "Sin datos para este mes."}</div>;
  const max = Math.max(1, ...rows.map((r) => value(r) ?? 0));
  return (
    <div className="mx-bl">
      {rows.map((r, i) => {
        const v = value(r);
        const pct = max > 0 ? (Math.max(0, v ?? 0) / max) * 100 : 0;
        return (
          <div
            key={i}
            className={`mx-bl-row${onClick ? " is-click" : ""}`}
            title={title?.(r)}
            onClick={onClick ? () => onClick(r) : undefined}
          >
            <div className="mx-bl-lab">{label(r)}</div>
            <div className="mx-bl-track">
              <div className="mx-bl-fill" style={{ width: `${pct}%`, background: color ? color(r) : "var(--accent)" }} />
            </div>
            <div className="mx-bl-val">{fmt(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ rows, colors }: { rows: { label: string; value: number }[]; colors: string[] }) {
  const data = rows.filter((r) => r.value > 0);
  if (!data.length) return <div className="mx-empty">Sin datos para este mes.</div>;
  const sum = data.reduce((a, r) => a + r.value, 0);
  const rOuter = 86,
    rInner = 54,
    cx = 100,
    cy = 95;
  const arcs = data.reduce<Array<(typeof data)[number] & { start: number; end: number }>>((acc, r) => {
    const prevEnd = acc.length ? acc[acc.length - 1].end : -90;
    const sweep = (r.value / sum) * 360;
    acc.push({ ...r, start: prevEnd, end: prevEnd + sweep });
    return acc;
  }, []);
  const toXY = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const arcPath = (s0: number, e0: number) => {
    const pad = 1.4,
      s = s0 + pad / 2,
      e = e0 - pad / 2;
    if (e <= s) return "";
    const [x1, y1] = toXY(s, rOuter),
      [x2, y2] = toXY(e, rOuter);
    const [x3, y3] = toXY(e, rInner),
      [x4, y4] = toXY(s, rInner);
    const large = e - s > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
  };
  const top = data[0];
  return (
    <div>
      <svg width="100%" viewBox="0 0 200 190" style={{ display: "block" }}>
        {arcs.map((a, i) => (
          <path key={a.label} d={arcPath(a.start, a.end)} fill={colors[i % colors.length]}>
            <title>{`${a.label}: ${F.int(a.value)} · ${((a.value / sum) * 100).toFixed(1)} %`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fill: "var(--fg)", fontFamily: "var(--display)", fontSize: 24 }}>
          {Math.round((top.value / sum) * 100)}%
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ fill: "var(--fg2)", fontSize: 11 }}>
          {top.label}
        </text>
      </svg>
      <div className="mx-legend">
        {data.map((r, i) => (
          <span key={r.label}>
            <i style={{ background: colors[i % colors.length] }} />
            {r.label}
            <b>{F.compact(r.value)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function useBoxWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(280, node.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type LinePoint = { k: string; label: string; head: string; y: number | null; y2?: number | null; head2?: string; partial?: boolean; sel?: boolean };

function LineChart({ points, fmt, tick, compare, dots, height = 230 }: { points: LinePoint[]; fmt: (v: number) => string; tick: (v: number) => string; compare?: boolean; dots?: boolean; height?: number }) {
  const [wrapRef, width] = useBoxWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pts = points.filter((p) => isNum(p.y));
  if (!pts.length) return <div className="mx-empty">Sin datos para este período.</div>;

  const W = width,
    H = height,
    top = 10,
    bottom = 26;
  const maxY = Math.max(1, ...pts.map((p) => Math.max(p.y ?? 0, compare && isNum(p.y2) ? (p.y2 as number) : 0))) * 1.1;
  const yt = ticks(maxY, 5);
  const left = Math.max(...yt.map((v) => tick(v).length), 2) * 6.5 + 16;
  const right = 12;
  const n = pts.length;
  const xAt = (i: number) => (n > 1 ? left + (i / (n - 1)) * (W - left - right) : (left + W - right) / 2);
  const yAt = (v: number) => H - bottom - (Math.max(0, v) / maxY) * (H - bottom - top);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.y as number).toFixed(1)}`).join(" ");
  const areaPath =
    `M ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} ` +
    pts.map((p, i) => `L ${xAt(i).toFixed(1)} ${yAt(p.y as number).toFixed(1)}`).join(" ") +
    ` L ${xAt(n - 1).toFixed(1)} ${yAt(0).toFixed(1)} Z`;
  const comparePts = pts.map((p, i) => ({ p, i })).filter(({ p }) => isNum(p.y2));
  const comparePath = comparePts.length
    ? comparePts.map(({ p, i }, idx) => `${idx === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.y2 as number).toFixed(1)}`).join(" ")
    : "";
  const maxLabelW = Math.max(...pts.map((p) => p.label.length), 1) * 6.5;
  const step = Math.max(1, Math.ceil(maxLabelW / Math.max(1, (W - left - right) / Math.max(1, n - 1))));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mxPos = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0,
      bestD = Infinity;
    pts.forEach((_, i) => {
      const d = Math.abs(xAt(i) - mxPos);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };
  const hoverPt = hover != null ? pts[hover] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <g className="mx-axis">
          {yt.map((v) => (
            <line key={v} x1={left} x2={W - 4} y1={yAt(v)} y2={yAt(v)} />
          ))}
          {yt.map((v) => (
            <text key={v} x={left - 8} y={yAt(v)} dy="0.35em" textAnchor="end">
              {tick(v)}
            </text>
          ))}
        </g>
        {pts.map((p, i) => i).filter((i) => i % step === 0).map((i) => (
          <text key={pts[i].k} x={xAt(i)} y={H - 6} textAnchor="middle" style={{ fill: "var(--fg2)", fontSize: 11 }}>
            {pts[i].label}
          </text>
        ))}
        <path d={areaPath} fill="var(--accent)" opacity={0.14} />
        {compare && comparePath && <path d={comparePath} fill="none" stroke="var(--fg3)" strokeWidth={1.75} strokeDasharray="4 4" />}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        {dots &&
          pts.map((p, i) => (
            <circle
              key={p.k}
              cx={xAt(i)}
              cy={yAt(p.y as number)}
              r={p.sel ? 5 : 3.5}
              fill={p.partial ? "var(--card)" : "var(--accent)"}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          ))}
        {hoverPt && <circle cx={xAt(hover as number)} cy={yAt(hoverPt.y as number)} r={5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />}
        <rect x={left} y={0} width={Math.max(0, W - left)} height={H} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hoverPt && (
        <div className="mx-tip" style={{ display: "block", left: Math.max(0, Math.min(W - 150, xAt(hover as number) + 12)), top: yAt(hoverPt.y as number) + 14 }}>
          <div className="mx-tip-h">{hoverPt.head}</div>
          <div>
            {fmt(hoverPt.y as number)}
            {hoverPt.partial ? " · mes incompleto" : ""}
          </div>
          {compare && (
            <div>
              {hoverPt.head2}: {isNum(hoverPt.y2) ? fmt(hoverPt.y2 as number) : "sin datos"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ColPoint = { k: string; label: string; head: string; y: number };

function ColumnsChart({
  points,
  fmt,
  tick,
  height = 220,
  isSelected,
  onClick,
}: {
  points: ColPoint[];
  fmt: (v: number) => string;
  tick: (v: number) => string;
  height?: number;
  isSelected?: (p: ColPoint) => boolean;
  onClick?: (p: ColPoint, shift: boolean) => void;
}) {
  const [wrapRef, width] = useBoxWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <div className="mx-empty">Sin datos para este mes.</div>;

  const W = width,
    H = height,
    top = 8,
    bottom = 24;
  const maxY = Math.max(1, ...points.map((p) => p.y)) * 1.08;
  const yt = ticks(maxY, 4);
  const left = Math.max(...yt.map((v) => tick(v).length), 2) * 6.5 + 14;
  const n = points.length;
  const gap = (W - left - 4) / n;
  const bw = Math.max(2, gap * 0.75);
  const xAt = (i: number) => left + i * gap + (gap - bw) / 2;
  const yAt = (v: number) => H - bottom - (Math.max(0, v) / maxY) * (H - bottom - top);
  const step = Math.max(1, Math.ceil((Math.max(...points.map((p) => p.label.length), 1) * 6.5 + 8) / Math.max(1, gap)));

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <g className="mx-axis">
          {yt.map((v) => (
            <line key={v} x1={left} x2={W} y1={yAt(v)} y2={yAt(v)} />
          ))}
          {yt.map((v) => (
            <text key={v} x={left - 8} y={yAt(v)} dy="0.35em" textAnchor="end">
              {tick(v)}
            </text>
          ))}
        </g>
        {points.map((p, i) => i).filter((i) => i % step === 0).map((i) => (
          <text key={points[i].k} x={xAt(i) + bw / 2} y={H - 6} textAnchor="middle" style={{ fill: "var(--fg2)", fontSize: 11 }}>
            {points[i].label}
          </text>
        ))}
        {points.map((p, i) => (
          <rect
            key={p.k}
            x={xAt(i)}
            width={bw}
            y={yAt(Math.max(0, p.y))}
            height={Math.max(0, yAt(0) - yAt(Math.max(0, p.y)))}
            rx={Math.min(4, bw / 2)}
            style={{ fill: "var(--accent)", opacity: isSelected && !isSelected(p) ? 0.3 : 1, cursor: onClick ? "pointer" : undefined }}
            onMouseMove={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={onClick ? (e) => onClick(p, e.shiftKey) : undefined}
          />
        ))}
      </svg>
      {hover != null && (
        <div className="mx-tip" style={{ display: "block", left: Math.max(0, Math.min(W - 150, xAt(hover) + bw / 2 + 12)), top: Math.max(0, yAt(points[hover].y) - 34) }}>
          <div className="mx-tip-h">{points[hover].head}</div>
          <div>{fmt(points[hover].y)}</div>
        </div>
      )}
    </div>
  );
}

function Funnel({ steps }: { steps: EmbudoRow[] }) {
  if (!steps.length || !isNum(steps[0].sesiones)) return <div className="mx-empty">Sin datos para este mes.</div>;
  const drops = steps.filter((s) => isNum(s.caida));
  if (!drops.length) return <div className="mx-empty">Sin datos para este mes.</div>;
  const worst = drops.reduce((a, b) => ((b.caida as number) > (a.caida as number) ? b : a), drops[0]);
  return (
    <>
      <div className="mx-funnel">
        {steps.map((s, i) => (
          <div key={s.paso} className="mx-fcol">
            <div className={`mx-fpar mx-fpar-${i + 1}`}>
              <div className="mx-fpar-v">{F.int(s.sesiones)}</div>
              <div className="mx-fpar-l">{s.paso}</div>
            </div>
            <div className={`mx-fpie${s === worst ? " is-max" : ""}`}>
              {i === 0 ? (
                "100 %"
              ) : (
                <>
                  {pctNeg(s.caida)}
                  <span className="mx-fpie-n">vs {steps[i - 1].paso.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {worst && steps.indexOf(worst) > 0 && (
        <p className="mx-lead">
          La mayor caída está entre {steps[steps.indexOf(worst) - 1].paso.toLowerCase()} y {worst.paso.toLowerCase()}: <b>{pctNeg(worst.caida)}</b>.
        </p>
      )}
    </>
  );
}

function Table<T>({ columns, rows, rowKey, empty }: { columns: { key: string; label: string; num?: boolean; sec?: boolean; render: (r: T) => React.ReactNode }[]; rows: T[]; rowKey: (r: T) => string; empty?: string }) {
  return (
    <div className="mx-tablewrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={[c.num ? "num" : "", c.sec ? "mx-sec" : ""].filter(Boolean).join(" ")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="mx-empty" colSpan={columns.length}>
                {empty ?? "Sin datos para este mes."}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={[c.num ? "num" : "", c.sec ? "mx-sec" : ""].filter(Boolean).join(" ")}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- narrativa ----------
function heroTexts(r: MensualRow | null, p: MensualRow | null) {
  if (!r) return { pulso: "", title: "" as React.ReactNode, sub: "" as React.ReactNode };
  const v = r.var_fact;
  const pulso = !isNum(v) ? "Pulso" : v! > 0 ? "Pulso · alza" : v! < 0 ? "Pulso · caída" : "Pulso · igual";
  const title = (
    <>
      La facturación de {r.etiqueta} {!isNum(v) ? "no tiene mes anterior para comparar" : v! > 0 ? "creció " : v! < 0 ? "cayó " : "se mantuvo igual"}
      {isNum(v) && v !== 0 && <span>{pctAbs(v as number)}</span>}
    </>
  );
  const sub = (
    <>
      En {r.etiqueta} hubo <b>{F.int(r.sesiones)}</b> sesiones
      {p && isNum(p.sesiones) && (
        <>
          {" "}
          frente a <b>{F.int(p.sesiones)}</b> de {p.etiqueta}
        </>
      )}
      , con ventas por <b>{F.money(r.fact_sin_iva)}</b> sin IVA.
      {!r.completo && ` El mes tiene datos hasta el ${F.date(r.hasta)}: la comparación contra un mes completo exagera la caída.`}
    </>
  );
  return { pulso, title, sub };
}

function insightContent(r: MensualRow | null) {
  if (!r || !isNum(r.var_fact) || !isNum(r.var_ticket) || !isNum(r.var_sesiones)) return null;
  const f = r.var_fact as number,
    tk = r.var_ticket as number,
    s = r.var_sesiones as number;
  const n = (val: number) => <b>{pctAbs(val)}</b>;
  let titulo: string;
  let parts: React.ReactNode;
  if (f > 0 && tk > 0 && s < 0) {
    titulo = "El ticket promedio impulsa la facturación";
    parts = (
      <>
        La facturación creció {n(f)}, a pesar de una caída de {n(s)} en las sesiones. El aumento de {n(tk)} en el ticket promedio fue clave para sostener el crecimiento.
      </>
    );
  } else if (f > 0 && tk >= 0 && s > 0) {
    titulo = "El crecimiento de sesiones impulsa las ventas";
    parts = (
      <>
        La facturación creció {n(f)}, acompañada por un aumento de {n(s)} en las sesiones. El mayor tráfico contribuyó al crecimiento de las ventas.
      </>
    );
  } else if (f > 0 && tk < 0 && s > 0) {
    titulo = "El mayor volumen compensa la caída del ticket";
    parts = (
      <>
        La facturación creció {n(f)}, impulsada por un aumento de {n(s)} en las sesiones, que compensó una caída de {n(tk)} en el ticket promedio.
      </>
    );
  } else if (f < 0 && s < 0) {
    titulo = "La caída de sesiones impacta en la facturación";
    parts = (
      <>
        La facturación cayó {n(f)}, en un contexto de {n(s)} menos sesiones. La menor actividad aparece como uno de los principales factores de la caída.
      </>
    );
  } else if (f < 0 && tk < 0 && s > 0) {
    titulo = "Más sesiones, pero menor monetización";
    parts = (
      <>
        Las sesiones crecieron {n(s)}, pero la facturación cayó {n(f)}. La baja de {n(tk)} en el ticket promedio muestra que el mayor tráfico no se traduce en más ventas.
      </>
    );
  } else {
    titulo = f >= 0 ? "La facturación se sostiene" : "La facturación retrocede";
    parts = (
      <>
        La facturación {f >= 0 ? "creció " : "cayó "}
        {n(f)}, con sesiones {s >= 0 ? "en alza de " : "en baja de "}
        {n(s)} y un ticket {tk >= 0 ? "que subió " : "que bajó "}
        {n(tk)}.
      </>
    );
  }
  return { titulo, parts, incompleto: !r.completo, hasta: r.hasta };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesN = (d: string) => MESES[+d.slice(5, 7) - 1];
const diaN = (d: string) => String(+d.slice(8, 10));
function tramo(a: string, b: string, mesEntero: boolean) {
  if (mesEntero) return mesN(a) + " completo";
  if (a === b) return diaN(a) + " de " + mesN(a);
  return "del " + diaN(a) + " al " + diaN(b) + " de " + mesN(a);
}

const DEV: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet", other: "Otro", "N/A": "Sin dato" };
const PERF = {
  fact_sin_iva: { unit: "facturación sin IVA", fmt: F.moneyc, tick: (v: number) => "$" + F.compact(v) },
  ordenes: { unit: "órdenes", fmt: F.int, tick: (v: number) => F.compact(v) },
  sesiones: { unit: "sesiones", fmt: F.compact, tick: (v: number) => F.compact(v) },
  ticket_sin_iva: { unit: "ticket promedio sin IVA", fmt: F.money, tick: (v: number) => "$" + F.compact(v) },
  conversion: { unit: "tasa de conversión", fmt: F.pctNum, tick: (v: number) => v.toFixed(2) + "%" },
} as const;
type PerfMetric = keyof typeof PERF;

const PAGES = [
  { id: "pulso", label: "Pulso" },
  { id: "embudo", label: "Embudo" },
  { id: "canales", label: "Canales" },
] as const;
type PageId = (typeof PAGES)[number]["id"];
const SUBS = [
  { id: "trafico", label: "Tráfico y adquisición" },
  { id: "conversion", label: "Conversión y comportamiento" },
  { id: "negocio", label: "Negocio y facturación" },
] as const;
type SubId = (typeof SUBS)[number]["id"];

export default function GrowthDashboard({ canalDia, canales, dispositivo, mensual, negocioDia, productoDia, trafico, traficoDia, fontClassName }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [page, setPage] = useState<PageId>("pulso");
  const [sub, setSub] = useState<SubId>("trafico");
  const [perfMetric, setPerfMetric] = useState<PerfMetric>("fact_sin_iva");
  const [mesSel, setMesSel] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [nDesde, setNDesde] = useState<string | null>(null);
  const [nHasta, setNHasta] = useState<string | null>(null);
  const negAncla = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Postea la altura y reenvía el scroll al padre — mismo patrón que
  // app/reportes/influencers para embeber en un iframe de Softr.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined" || window.parent === window) return;
    const post = () => window.parent.postMessage({ source: "coolmetrics-report", height: el.scrollHeight }, "*");
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, sub, theme, mesSel]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const mesesConDatos = useMemo(() => mensual.filter((r) => r.dias_datos > 0), [mensual]);
  const curMes = useMemo(() => {
    if (mesSel && mesesConDatos.some((r) => r.mes === mesSel)) return mesSel;
    const last = [...mesesConDatos].reverse().find((r) => r.completo) ?? mesesConDatos[mesesConDatos.length - 1];
    return last?.mes ?? null;
  }, [mesSel, mesesConDatos]);

  const row = (m: string | null) => mensual.find((r) => r.mes === m) ?? null;
  const prevRow = (m: string | null) => {
    const i = mensual.findIndex((r) => r.mes === m);
    return i > 0 ? mensual[i - 1] : null;
  };
  const r = row(curMes);

  const onMesChange = (m: string) => {
    setMesSel(m);
    setDesde(null);
    setHasta(null);
    setNDesde(null);
    setNHasta(null);
    negAncla.current = null;
  };

  // ---------- derivados ----------
  const embudo = useMemo(() => calcEmbudo(mensual), [mensual]);
  const traficoRango = useMemo(() => calcTraficoRango(traficoDia), [traficoDia]);
  const negocioRango = useMemo(() => calcNegocioRango(negocioDia), [negocioDia]);
  const productosRango = useMemo(() => calcProductosRango(productoDia), [productoDia]);
  const canalesRango = useMemo(() => calcCanalesRango(canalDia), [canalDia]);

  // ---------- rango de días: Tráfico y adquisición ----------
  const mesDiasTrafico = useMemo(() => traficoDia.filter((d) => d.mes === curMes).map((d) => d.dia).sort(), [traficoDia, curMes]);
  const rangoTrafico = useMemo(() => {
    if (!mesDiasTrafico.length) return null;
    let a = desde && mesDiasTrafico.includes(desde) ? desde : mesDiasTrafico[0];
    let b = hasta && mesDiasTrafico.includes(hasta) ? hasta : mesDiasTrafico[mesDiasTrafico.length - 1];
    if (a > b) [a, b] = [b, a];
    return { desde: a, hasta: b, dias: mesDiasTrafico };
  }, [mesDiasTrafico, desde, hasta]);
  const traficoRangoRow = rangoTrafico ? traficoRango.find((x) => x.desde === rangoTrafico.desde && x.hasta === rangoTrafico.hasta) ?? null : null;

  // ---------- rango de días: Negocio y facturación ----------
  const mesDiasNegocio = useMemo(() => negocioDia.filter((d) => d.mes === curMes).map((d) => d.dia).sort(), [negocioDia, curMes]);
  const rangoNegocio = useMemo(() => {
    if (!mesDiasNegocio.length) return null;
    let a = nDesde && mesDiasNegocio.includes(nDesde) ? nDesde : mesDiasNegocio[0];
    let b = nHasta && mesDiasNegocio.includes(nHasta) ? nHasta : mesDiasNegocio[mesDiasNegocio.length - 1];
    if (!nDesde || !nHasta) {
      a = mesDiasNegocio[0];
      b = mesDiasNegocio[mesDiasNegocio.length - 1];
    }
    if (a > b) [a, b] = [b, a];
    return { desde: a, hasta: b, dias: mesDiasNegocio };
  }, [mesDiasNegocio, nDesde, nHasta]);
  const negEsMes = !!rangoNegocio && rangoNegocio.desde === rangoNegocio.dias[0] && rangoNegocio.hasta === rangoNegocio.dias[rangoNegocio.dias.length - 1];
  const negocioRangoRow = rangoNegocio ? negocioRango.find((x) => x.desde === rangoNegocio.desde && x.hasta === rangoNegocio.hasta) ?? null : null;

  const negClick = (dia: string, shift: boolean) => {
    if (!rangoNegocio) return;
    if (shift && negAncla.current) {
      const [a, b] = [negAncla.current, dia].sort();
      setNDesde(a);
      setNHasta(b);
      return;
    }
    if (!negEsMes && rangoNegocio.desde === dia && rangoNegocio.hasta === dia) {
      negAncla.current = null;
      setNDesde(null);
      setNHasta(null);
      return;
    }
    negAncla.current = dia;
    setNDesde(dia);
    setNHasta(dia);
  };

  // ---------- hero / insight ----------
  const hero = heroTexts(r, prevRow(curMes));
  const insight = insightContent(r);

  const monthOptions = useMemo(() => [...mesesConDatos].reverse(), [mesesConDatos]);

  return (
    <div ref={rootRef} className={`mx ${fontClassName}`} data-theme={theme}>
      <div className="mx-wrap">
        <header>
          <div className="mx-top">
            <div>
              <div className="mx-kicker">MOSCÚ · Framework desk</div>
              <h1 className="mx-title">Decathlon Growth</h1>
            </div>
            <div className="mx-theme" role="group" aria-label="Tema">
              <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
                Oscura
              </button>
              <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
                Clara
              </button>
            </div>
          </div>
          <nav className="mx-pages" role="tablist" aria-label="Secciones">
            {PAGES.map((p) => (
              <button key={p.id} role="tab" aria-selected={page === p.id} onClick={() => setPage(p.id)}>
                {p.label}
              </button>
            ))}
          </nav>
          <div className="mx-period">
            <label>
              Período{" "}
              <select value={curMes ?? ""} onChange={(e) => onMesChange(e.target.value)}>
                {monthOptions.map((m) => (
                  <option key={m.mes} value={m.mes}>
                    {m.etiqueta}
                    {m.completo ? "" : " · incompleto"}
                  </option>
                ))}
              </select>
            </label>
            {r && <span className="mx-sub" style={{ margin: 0 }}>Datos hasta el <b>{F.date(r.hasta)}</b></span>}
            {r && !r.completo && <span className="mx-flag">Mes incompleto</span>}
          </div>
        </header>

        {page === "pulso" && (
          <section className="mx-hero">
            <div className="mx-hero-head">
              <div className="mx-logo" aria-hidden="true">D</div>
              <div>
                <div className="mx-pulso">{hero.pulso}</div>
                <div className="mx-hero-title">{hero.title}</div>
                <div className="mx-hero-sub">{hero.sub}</div>
              </div>
            </div>
            <div className="mx-kpis">
              <KpiTile hero label="Facturación sin IVA" value={F.moneyc(r?.fact_sin_iva)}>
                <Delta hero value={r?.var_fact} fmt={D.pct} note="vs mes anterior" />
              </KpiTile>
              <KpiTile hero label="Sesiones" value={F.compact(r?.sesiones)}>
                <Delta hero value={r?.var_sesiones} fmt={D.pct} note="vs mes anterior" />
              </KpiTile>
              <KpiTile hero label="Tasa de conversión" value={F.pctNum(r?.conversion)}>
                <Delta hero value={r?.dif_conversion} fmt={D.ppNum} note="vs mes anterior" />
              </KpiTile>
              <KpiTile hero label="Ticket promedio sin IVA" value={F.money(r?.ticket_sin_iva)}>
                <Delta hero value={r?.var_ticket} fmt={D.pct} note="vs mes anterior" />
              </KpiTile>
              <KpiTile hero label="ROAS blended" value={F.x(r?.roas)}>
                {r && !r.completo ? (
                  <div className="mx-kpi-s">No comparable: ventas hasta el {F.date(r.hasta)} contra la inversión cargada para el mes.</div>
                ) : (
                  <Delta hero value={r?.dif_roas} fmt={D.x} note="vs mes anterior" />
                )}
              </KpiTile>
              <KpiTile hero label="Peso ecommerce" value={F.pct(r?.peso_ecommerce)}>
                <Delta hero value={r?.dif_peso} fmt={D.pp} note="vs mes anterior" />
              </KpiTile>
            </div>
          </section>
        )}

        {page === "pulso" && (
          <PulsoPage r={r} mensual={mensual} curMes={curMes} perfMetric={perfMetric} setPerfMetric={setPerfMetric} insight={insight} />
        )}

        {page === "embudo" && (
          <section className="mx-page">
            <p className="mx-sub" style={{ margin: 0 }}>
              Del tráfico a la facturación, en una sola lectura: cuánta gente llegó, cuánta compró y cuánto dejó.
            </p>
            <nav className="mx-subtabs" role="tablist" aria-label="Tramos del embudo">
              {SUBS.map((s) => (
                <button key={s.id} role="tab" aria-selected={sub === s.id} onClick={() => setSub(s.id)}>
                  {s.label}
                </button>
              ))}
            </nav>

            {sub === "trafico" && (
              <TraficoSubPage
                rango={rangoTrafico}
                rangoRow={traficoRangoRow}
                traficoDia={traficoDia}
                canalesRango={canalesRango}
                dispositivoAgg={traficoRangoRow}
                setDesde={setDesde}
                setHasta={setHasta}
              />
            )}
            {sub === "conversion" && (
              <ConversionSubPage r={r} curMes={curMes} embudo={embudo} canales={canales} dispositivo={dispositivo} />
            )}
            {sub === "negocio" && (
              <NegocioSubPage
                m={r}
                rango={rangoNegocio}
                rangoRow={negocioRangoRow}
                negEsMes={negEsMes}
                negocioDia={negocioDia}
                productosRango={productosRango}
                onBarClick={negClick}
                onReset={() => {
                  negAncla.current = null;
                  setNDesde(null);
                  setNHasta(null);
                }}
              />
            )}
          </section>
        )}

        {page === "canales" && <CanalesPage r={r} curMes={curMes} canales={canales} trafico={trafico} />}

        <p className="mx-foot">
          Cómo leer estos números: la facturación y el ticket promedio se muestran sin IVA, con el valor con IVA debajo. La inversión en pauta también se toma sin IVA, así que el ROAS y la inversión sobre facturación comparan ventas e inversión en la misma base. Las variaciones son contra el mes anterior completo; en Tráfico y adquisición, contra los mismos días del mes anterior.
        </p>
      </div>
    </div>
  );
}

// ---------- página Pulso ----------
function PulsoPage({
  r,
  mensual,
  curMes,
  perfMetric,
  setPerfMetric,
  insight,
}: {
  r: MensualRow | null;
  mensual: MensualRow[];
  curMes: string | null;
  perfMetric: PerfMetric;
  setPerfMetric: (m: PerfMetric) => void;
  insight: ReturnType<typeof insightContent>;
}) {
  const i = mensual.findIndex((x) => x.mes === curMes);
  const win = mensual.slice(Math.max(0, i - 11), i + 1).filter((x) => x.completo || x.mes === curMes);
  const P = PERF[perfMetric];
  const points: LinePoint[] = win
    .filter((x) => isNum(x[perfMetric]))
    .map((x) => ({ k: x.mes, label: x.abrev, head: x.etiqueta, y: x[perfMetric] as number, partial: !x.completo, sel: x.mes === curMes }));

  const odd =
    r &&
    [
      ["fact_sin_iva", "obj_facturacion"],
      ["ordenes", "obj_ordenes"],
      ["conversion", "obj_conversion"],
    ].some(([f, o]) => {
      const goal = r[o as keyof MensualRow] as number | null;
      const val = r[f as keyof MensualRow] as number | null;
      if (!isNum(goal) || goal === 0) return false;
      const ratio = (val ?? 0) / goal!;
      return ratio > 5 || ratio < 0.05;
    });

  return (
    <section className="mx-page">
      <div className="mx-grid">
        <div className="mx-card">
          <div className="mx-card-head">
            <h2>Performance · últimos 12 meses</h2>
            <div className="mx-seg" role="group" aria-label="Métrica">
              {(Object.keys(PERF) as PerfMetric[]).map((m) => (
                <button key={m} type="button" aria-pressed={perfMetric === m} onClick={() => setPerfMetric(m)}>
                  {m === "fact_sin_iva" ? "Facturación" : m === "ordenes" ? "Órdenes" : m === "sesiones" ? "Sesiones" : m === "ticket_sin_iva" ? "Ticket" : "Conversión"}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-big">
            <span>{r ? P.fmt(r[perfMetric] as number) : "—"}</span>
            <small>
              {P.unit}
              {r ? " · " + r.etiqueta : ""}
            </small>
          </div>
          <div className="mx-box" style={{ minHeight: 230 }}>
            <LineChart points={points} fmt={P.fmt} tick={P.tick} dots height={230} />
          </div>
          <p className="mx-note" style={{ margin: "8px 0 0" }}>
            Solo meses con datos completos; el mes en curso aparece con un punto hueco.
          </p>
        </div>
        <div className="mx-card">
          <h2>Avance de objetivos</h2>
          <p className="mx-note">Lo logrado en el mes contra el objetivo cargado.</p>
          <GoalBar label="Facturación sin IVA" value={r?.fact_sin_iva} fmt={F.moneyc} goal={r?.obj_facturacion} />
          <GoalBar label="Órdenes" value={r?.ordenes} fmt={F.int} goal={r?.obj_ordenes} />
          <GoalBar label="Tasa de conversión" value={r?.conversion} fmt={F.pctNum} goal={r?.obj_conversion} />
          {odd && (
            <div className="mx-warnbox">
              Algún objetivo de este mes no está en la misma escala que el resultado: el avance no es interpretable hasta corregir el objetivo cargado.
            </div>
          )}
        </div>
      </div>
      <div className="mx-grid">
        <div className="mx-card">
          <h2>Insight del mes</h2>
          {insight ? (
            <>
              <div className="mx-insight-t">{insight.titulo}</div>
              <p className="mx-insight">
                {insight.parts}
                {insight.incompleto && ` Ojo: el mes tiene datos hasta el ${F.date(insight.hasta)}, y se compara contra un mes completo.`}
              </p>
            </>
          ) : (
            <p className="mx-insight">Sin mes anterior para comparar.</p>
          )}
        </div>
        <div className="mx-card">
          <h2>Inversión y retorno</h2>
          <p className="mx-note">Inversión total en pauta frente a la facturación digital.</p>
          <div className="mx-tiles">
            <KpiTile label="Inversión en pauta" value={F.moneyc(r?.inversion_sin_iva)}>
              <div className="mx-tile-s">sin IVA</div>
            </KpiTile>
            <KpiTile label="Inversión / facturación" value={F.pct(r?.inversion_sobre_fact)}>
              {r && !r.completo ? (
                <div className="mx-tile-s">No comparable: ventas hasta el {F.date(r.hasta)} contra la inversión cargada para el mes.</div>
              ) : (
                <Delta value={r?.dif_inversion_fact} fmt={D.pp} neutral note="vs mes anterior" />
              )}
            </KpiTile>
            <KpiTile label="Sesiones diarias" value={F.int(r?.sesiones_diarias)}>
              <Delta value={r?.var_sesiones_diarias} fmt={D.pct} note="vs mes anterior" />
            </KpiTile>
            <KpiTile label="Costo por sesión" value={F.money(r?.costo_sesion_sin_iva)}>
              <Delta value={r?.var_costo_sesion} fmt={D.pct} invert note="vs mes anterior" />
              <div className="mx-tile-s">sin IVA</div>
            </KpiTile>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- subpágina Tráfico y adquisición ----------
function TraficoSubPage({
  rango,
  rangoRow,
  traficoDia,
  canalesRango,
  dispositivoAgg,
  setDesde,
  setHasta,
}: {
  rango: { desde: string; hasta: string; dias: string[] } | null;
  rangoRow: TraficoRangoRow | null;
  traficoDia: TraficoDiaRow[];
  canalesRango: CanalRangoRow[];
  dispositivoAgg: TraficoRangoRow | null;
  setDesde: (d: string | null) => void;
  setHasta: (d: string | null) => void;
}) {
  const dLabel = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
  const by = useMemo(() => new Map(traficoDia.map((d) => [d.dia, d])), [traficoDia]);
  const puntos: LinePoint[] = rango
    ? rango.dias
        .filter((d) => d >= rango.desde && d <= rango.hasta)
        .map((d) => {
          const prev = by.get(edate(d));
          return { k: d, label: dLabel(d), head: F.date(d), y: by.get(d)?.sesiones ?? null, y2: prev ? prev.sesiones : null, head2: F.date(edate(d)) };
        })
    : [];
  const canalesFiltrados = rango
    ? canalesRango
        .filter((x) => x.desde === rango.desde && x.hasta === rango.hasta && x.sesiones > 0)
        .sort((a, b) => Number(a.canal === "Otros") - Number(b.canal === "Otros") || b.sesiones - a.sesiones)
    : [];

  return (
    <div className="mx-sub-page">
      <div className="mx-filters mx-dias">
        <label>
          Desde
          <select value={rango?.desde ?? ""} onChange={(e) => setDesde(e.target.value || null)}>
            {(rango?.dias ?? []).map((d) => (
              <option key={d} value={d}>
                {dLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hasta
          <select value={rango?.hasta ?? ""} onChange={(e) => setHasta(e.target.value || null)}>
            {(rango?.dias ?? []).map((d) => (
              <option key={d} value={d}>
                {dLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <div className="mx-compara">
          <span className="mx-label" style={{ color: "var(--fg2)" }}>
            Comparado con
          </span>
          <div className="mx-compara-v">
            {rangoRow ? (
              <>
                {dLabel(rangoRow.ant_desde)} – {dLabel(rangoRow.ant_hasta)}
                {rangoRow.dias_ant ? ` · ${rangoRow.dias_ant} ${rangoRow.dias_ant === 1 ? "día" : "días"}` : " · sin datos"}
              </>
            ) : (
              ""
            )}
          </div>
        </div>
        <button
          className="mx-clear"
          type="button"
          onClick={() => {
            setDesde(null);
            setHasta(null);
          }}
        >
          Todo el mes
        </button>
      </div>

      <div className="mx-tiles">
        <KpiTile label="Sesiones totales" value={F.int(rangoRow?.sesiones)}>
          <Delta value={rangoRow?.var_sesiones} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Share tráfico pago" value={F.pct(rangoRow?.share_pago)}>
          <Delta value={rangoRow?.dif_share_pago} fmt={D.pp} neutral note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Share tráfico orgánico" value={F.pct(rangoRow?.share_organico)}>
          <Delta value={rangoRow?.dif_share_organico} fmt={D.pp} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Tasa de rebote" value={F.pct(rangoRow?.rebote)}>
          <Delta value={rangoRow?.var_rebote} fmt={D.pct} invert note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Sesiones diarias" value={F.int(rangoRow?.sesiones_diarias)}>
          <Delta value={rangoRow?.var_sesiones_diarias} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Clientes nuevos" value={F.int(rangoRow?.clientes_nuevos)}>
          <Delta value={rangoRow?.var_clientes_nuevos} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Clientes recurrentes" value={F.int(rangoRow?.clientes_recurrentes)}>
          <Delta value={rangoRow?.var_clientes_recurrentes} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
      </div>

      <div className="mx-card">
        <h2>Evolución diaria de sesiones</h2>
        <p className="mx-note">Días elegidos contra los mismos días del mes anterior.</p>
        <div className="mx-legend" style={{ margin: "0 0 8px" }}>
          <span>
            <i style={{ background: "var(--accent)" }} />
            Período elegido
          </span>
          <span>
            <i style={{ background: "var(--fg3)" }} />
            Mismos días, mes anterior
          </span>
        </div>
        <div className="mx-box" style={{ minHeight: 200 }}>
          <LineChart points={puntos} fmt={F.int} tick={F.compact} compare height={200} />
        </div>
      </div>

      <div className="mx-grid">
        <div className="mx-card">
          <h2>Share de tráfico por canal · top 10</h2>
          <p className="mx-note">Porcentaje de las sesiones del período. Los canales fuera del top 10 del año van en Otros.</p>
          <div className="mx-box" style={{ minHeight: 280 }}>
            <BarList
              rows={canalesFiltrados}
              label={(x) => x.canal}
              value={(x) => x.share}
              fmt={F.pct}
              color={(x) => (x.canal === "Otros" ? "var(--fg3)" : "var(--accent)")}
            />
          </div>
        </div>
        <div className="mx-card">
          <h2>Mobile vs desktop</h2>
          <p className="mx-note">Sesiones del período por dispositivo.</p>
          <div className="mx-box" style={{ minHeight: 240 }}>
            <Donut
              rows={[
                { label: "Mobile", value: dispositivoAgg?.sesiones_mobile ?? 0 },
                { label: "Desktop", value: dispositivoAgg?.sesiones_desktop ?? 0 },
                { label: "Otros", value: dispositivoAgg?.sesiones_otro_dispositivo ?? 0 },
              ]}
              colors={["var(--accent)", "var(--k1)", "var(--fg3)"]}
            />
          </div>
        </div>
      </div>

      <div className="mx-card">
        <h2>Sesiones por canal</h2>
        <p className="mx-note">Contra los mismos días del mes anterior. El cambio de share es en puntos porcentuales.</p>
        <Table
          columns={[
            { key: "canal", label: "Canal", render: (x: CanalRangoRow) => x.canal },
            { key: "sesiones", label: "Sesiones", num: true, render: (x: CanalRangoRow) => F.int(x.sesiones) },
            { key: "sesiones_ant", label: "Período anterior", num: true, sec: true, render: (x: CanalRangoRow) => F.int(x.sesiones_ant) },
            { key: "share", label: "Share", num: true, render: (x: CanalRangoRow) => F.pct(x.share) },
            { key: "dif_share", label: "Cambio de share", num: true, render: (x: CanalRangoRow) => D.pp(x.dif_share) },
          ]}
          rows={canalesFiltrados}
          rowKey={(x) => x.canal}
        />
      </div>
    </div>
  );
}

// ---------- subpágina Conversión y comportamiento ----------
function ConversionSubPage({ r, curMes, embudo, canales, dispositivo }: { r: MensualRow | null; curMes: string | null; embudo: EmbudoRow[]; canales: CanalRow[]; dispositivo: DispositivoRow[] }) {
  const pasos = embudo.filter((s) => s.mes === curMes).sort((a, b) => a.orden - b.orden);
  const convCanal = canales.filter((c) => c.mes === curMes && c.puesto <= 10).sort((a, b) => (b.tasa_adquisicion || 0) - (a.tasa_adquisicion || 0));
  const convDevice = dispositivo.filter((d) => d.mes === curMes && d.sesiones >= 500);
  return (
    <div className="mx-sub-page">
      <div className="mx-tiles">
        <KpiTile label="Tasa de conversión" value={F.pctNum(r?.conversion)}>
          <Delta value={r?.dif_conversion} fmt={D.ppNum} note="vs mes anterior" />
          <div className="mx-tile-s">Objetivo: {isNum(r?.obj_conversion) ? F.pctNum(r!.obj_conversion) : "sin cargar"}</div>
        </KpiTile>
        <KpiTile label="Abandono de carrito" value={F.pct(r?.abandono_carrito)}>
          <Delta value={r?.dif_abandono_carrito} fmt={D.pp} invert note="vs mes anterior" />
        </KpiTile>
        <KpiTile label="Abandono de checkout" value={F.pct(r?.abandono_checkout)}>
          <Delta value={r?.dif_abandono_checkout} fmt={D.pp} invert note="vs mes anterior" />
        </KpiTile>
        <KpiTile label="Órdenes" value={F.int(r?.ordenes)}>
          <Delta value={r?.var_ordenes} fmt={D.pct} note="vs mes anterior" />
        </KpiTile>
      </div>
      <div className="mx-card">
        <h2>Embudo de conversión</h2>
        <p className="mx-note">Sesiones que llegan a cada paso en el mes, y cuánto se pierde respecto del paso anterior.</p>
        <div className="mx-box" style={{ minHeight: 150 }}>
          <Funnel steps={pasos} />
        </div>
      </div>
      <div className="mx-grid">
        <div className="mx-card">
          <h2>Conversión por canal · top 10</h2>
          <p className="mx-note">Órdenes sobre sesiones de cada canal.</p>
          <div className="mx-box" style={{ minHeight: 280 }}>
            <BarList rows={convCanal} label={(x) => x.canal} value={(x) => x.tasa_adquisicion} fmt={F.pct2} title={(x) => `${F.int(x.ordenes)} órdenes de ${F.int(x.sesiones)} sesiones`} />
          </div>
        </div>
        <div className="mx-card">
          <h2>Conversión por dispositivo</h2>
          <p className="mx-note">Compras sobre sesiones de cada dispositivo.</p>
          <div className="mx-box" style={{ minHeight: 160 }}>
            <BarList
              rows={convDevice}
              label={(x) => DEV[x.dispositivo] ?? x.dispositivo}
              value={(x) => x.conversion}
              fmt={F.pctNum}
              title={(x) => `${F.int(x.compras)} compras de ${F.int(x.sesiones)} sesiones`}
              empty="Sin dispositivos con volumen suficiente."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- subpágina Negocio y facturación ----------
function NegocioSubPage({
  m,
  rango,
  rangoRow,
  negEsMes,
  negocioDia,
  productosRango,
  onBarClick,
  onReset,
}: {
  m: MensualRow | null;
  rango: { desde: string; hasta: string; dias: string[] } | null;
  rangoRow: NegocioRangoRow | null;
  negEsMes: boolean;
  negocioDia: NegocioDiaRow[];
  productosRango: ProductoRangoRow[];
  onBarClick: (dia: string, shift: boolean) => void;
  onReset: () => void;
}) {
  const dayLabel = (d: string) => d.slice(8, 10);
  const strip = useMemo(() => {
    if (!rangoRow) return null;
    const mesCompleto = negEsMes && m && m.completo;
    const actual = tramo(rangoRow.desde, rangoRow.hasta, !!mesCompleto);
    const previoCompleto = !!mesCompleto && rangoRow.ant_desde.slice(8) === "01" && rangoRow.dias_ant >= 28;
    const mismos = diaN(rangoRow.ant_desde) === diaN(rangoRow.desde) && diaN(rangoRow.ant_hasta) === diaN(rangoRow.hasta);
    const previo = !rangoRow.dias_ant
      ? null
      : previoCompleto
        ? mesN(rangoRow.ant_desde) + " completo"
        : rangoRow.desde === rangoRow.hasta
          ? tramo(rangoRow.ant_desde, rangoRow.ant_hasta, false)
          : mismos
            ? "los mismos días de " + mesN(rangoRow.ant_desde)
            : tramo(rangoRow.ant_desde, rangoRow.ant_hasta, false);
    return { actual, previo, diffDias: rangoRow.dias_ant < rangoRow.dias, antMes: mesN(rangoRow.ant_desde), diasAnt: rangoRow.dias_ant, dias: rangoRow.dias, full: negEsMes };
  }, [rangoRow, negEsMes, m]);

  const rows = negocioDia.filter((d) => d.mes === m?.mes);
  const productosFiltrados = rango
    ? productosRango
        .filter((x) => x.desde === rango.desde && x.hasta === rango.hasta && x.fact_sin_iva > 0)
        .sort((a, b) => Number(a.tipo === "Otros") - Number(b.tipo === "Otros") || b.fact_sin_iva - a.fact_sin_iva)
    : [];

  return (
    <div className="mx-sub-page">
      <div className="mx-strip">
        <span className="mx-strip-t">
          {strip && (
            <>
              Estás viendo <b>{strip.actual}</b>
              {strip.previo ? (
                <>
                  , comparado con <b>{strip.previo}</b>.{strip.diffDias && ` Ojo: ${strip.antMes} tiene menos días en ese tramo (${strip.diasAnt} contra ${strip.dias}).`}
                </>
              ) : (
                ". No hay datos del mes anterior para comparar."
              )}
              {strip.full && " Hacé clic en una barra del gráfico para ver un día."}
            </>
          )}
        </span>
        {!negEsMes && (
          <button className="mx-clear" type="button" onClick={onReset}>
            Ver mes completo
          </button>
        )}
      </div>

      <div className="mx-tiles">
        <KpiTile label="Facturación digital sin IVA" value={F.moneyc(rangoRow?.fact_sin_iva)}>
          <Delta value={rangoRow?.var_fact} fmt={D.pct} note="vs mismos días del mes anterior" />
          <div className="mx-tile-s">
            <br />
            Con IVA <b>{F.moneyc(rangoRow?.fact_con_iva)}</b>
          </div>
        </KpiTile>
        <KpiTile label="Ticket promedio sin IVA" value={F.money(rangoRow?.ticket_sin_iva)}>
          <Delta value={rangoRow?.var_ticket} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Órdenes totales" value={F.int(rangoRow?.ordenes)}>
          <Delta value={rangoRow?.var_ordenes} fmt={D.pct} note="vs mismos días del mes anterior" />
        </KpiTile>
        <KpiTile label="Peso en negocio total" value={negEsMes && m ? F.pct(m.peso_ecommerce) : "—"}>
          {negEsMes && m ? (
            <Delta value={m.dif_peso} fmt={D.pp} note="vs mes anterior" />
          ) : (
            <div className="mx-tile-s">Solo para el mes completo: la facturación total del negocio se carga por mes.</div>
          )}
        </KpiTile>
      </div>

      <div className="mx-card">
        <h2>Facturación diaria</h2>
        <p className="mx-note">Sin IVA. Hacé clic en una barra para filtrar la sección por ese día; con Shift + clic elegís un rango.</p>
        <div className="mx-box" style={{ minHeight: 220 }}>
          <ColumnsChart
            points={rows.map((x) => ({ k: x.dia, label: dayLabel(x.dia), head: F.date(x.dia), y: x.fact_sin_iva }))}
            fmt={F.money}
            tick={(v) => "$" + F.compact(v)}
            height={220}
            isSelected={(p) => negEsMes || !rango || (p.k >= rango.desde && p.k <= rango.hasta)}
            onClick={(p, shift) => onBarClick(p.k, shift)}
          />
        </div>
      </div>

      <div className="mx-grid">
        <div className="mx-card">
          <h2>Avance del objetivo</h2>
          <p className="mx-note">El objetivo es mensual: se compara siempre el mes completo.</p>
          <GoalBar label="Facturación sin IVA" value={m?.fact_sin_iva} fmt={F.moneyc} goal={m?.obj_facturacion} />
          <GoalBar label="Órdenes" value={m?.ordenes} fmt={F.int} goal={m?.obj_ordenes} />
        </div>
        <div className="mx-card">
          <h2>Nuevos vs recurrentes</h2>
          <p className="mx-note">Facturación sin IVA por tipo de cliente en el período.</p>
          <div className="mx-box" style={{ minHeight: 90 }}>
            <BarList
              rows={[
                { k: "Nuevos", v: rangoRow?.fact_nuevos_sin_iva ?? null },
                { k: "Recurrentes", v: rangoRow?.fact_recurrentes_sin_iva ?? null },
              ]}
              label={(x) => x.k}
              value={(x) => x.v}
              fmt={F.moneyc}
              color={(x) => (x.k === "Nuevos" ? "var(--accent)" : "var(--k1)")}
            />
          </div>
        </div>
      </div>

      <div className="mx-card">
        <h2>Mix de ventas por tipo de producto</h2>
        <p className="mx-note">Facturación sin IVA del período. Los tipos fuera del top 10 del año van en Otros.</p>
        <div className="mx-box" style={{ minHeight: 280 }}>
          <BarList
            rows={productosFiltrados}
            label={(x) => x.tipo}
            value={(x) => x.fact_sin_iva}
            fmt={F.moneyc}
            title={(x) => `${F.int(x.unidades)} unidades`}
            color={(x) => (x.tipo === "Otros" ? "var(--fg3)" : "var(--accent)")}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- página Canales ----------
function CanalesPage({ r, curMes, canales, trafico }: { r: MensualRow | null; curMes: string | null; canales: CanalRow[]; trafico: TraficoRow[] }) {
  const top10 = canales.filter((c) => c.mes === curMes && c.puesto <= 10);
  const traficoMes = trafico.filter((t) => t.mes === curMes);
  const factCanal = [...top10].sort((a, b) => (b.fact_sin_iva || 0) - (a.fact_sin_iva || 0));
  return (
    <section className="mx-page">
      <p className="mx-sub" style={{ margin: 0 }}>
        Qué aporta cada canal al negocio: tráfico, conversión y facturación.
      </p>
      <div className="mx-tiles">
        <KpiTile label="Inversión total en pauta" value={F.moneyc(r?.inversion_sin_iva)}>
          <div className="mx-tile-s">sin IVA</div>
        </KpiTile>
        <KpiTile label="ROAS Meta" value={F.x(r?.roas_meta)}>
          <Delta value={r?.dif_roas_meta} fmt={D.x} note="vs mes anterior" />
        </KpiTile>
        <KpiTile label="Costo por sesión" value={F.money(r?.costo_sesion_sin_iva)}>
          <Delta value={r?.var_costo_sesion} fmt={D.pct} invert note="vs mes anterior" />
          <div className="mx-tile-s">sin IVA</div>
        </KpiTile>
        <KpiTile label="Costo por conversión" value={F.money(r?.costo_conversion_sin_iva)}>
          <Delta value={r?.var_costo_conversion} fmt={D.pct} invert note="vs mes anterior" />
          <div className="mx-tile-s">sin IVA</div>
        </KpiTile>
      </div>
      <div className="mx-card">
        <h2>Comparativa de canales · top 10</h2>
        <p className="mx-note">Canales del mes ordenados por sesiones. La facturación es la atribuida por Shopify al canal (último clic).</p>
        <Table
          columns={[
            { key: "canal", label: "Canal", render: (x: CanalRow) => x.canal },
            { key: "sesiones", label: "Sesiones", num: true, render: (x: CanalRow) => F.int(x.sesiones) },
            { key: "share_organico", label: "Orgánico", num: true, sec: true, render: (x: CanalRow) => F.pct(x.share_organico) },
            { key: "share_pago", label: "Pago", num: true, sec: true, render: (x: CanalRow) => F.pct(x.share_pago) },
            { key: "ordenes", label: "Órdenes", num: true, render: (x: CanalRow) => F.int(x.ordenes) },
            { key: "tasa_adquisicion", label: "Conversión", num: true, render: (x: CanalRow) => F.pct2(x.tasa_adquisicion) },
            { key: "fact_sin_iva", label: "Facturación", num: true, render: (x: CanalRow) => F.money(x.fact_sin_iva) },
          ]}
          rows={top10}
          rowKey={(x) => x.canal}
        />
      </div>
      <div className="mx-grid">
        <div className="mx-card">
          <h2>Tráfico pago vs orgánico</h2>
          <p className="mx-note">Sesiones del mes por tipo de tráfico. &quot;Otros&quot; agrupa directo, desconocido y sin atribuir.</p>
          <div className="mx-box" style={{ minHeight: 140 }}>
            <BarList
              rows={traficoMes}
              label={(x) => x.grupo}
              value={(x) => x.sesiones}
              fmt={F.compact}
              color={(x) => (x.grupo === "Pago" ? "var(--accent)" : x.grupo === "Orgánico" ? "var(--k3)" : "var(--fg3)")}
            />
          </div>
        </div>
        <div className="mx-card">
          <h2>Facturación por canal</h2>
          <p className="mx-note">Sin IVA, canales del top 10 por sesiones.</p>
          <div className="mx-box" style={{ minHeight: 280 }}>
            <BarList rows={factCanal} label={(x) => x.canal} value={(x) => x.fact_sin_iva} fmt={F.moneyc} />
          </div>
        </div>
      </div>
    </section>
  );
}
