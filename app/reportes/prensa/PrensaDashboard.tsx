"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CampanaRow,
  DetalleRow,
  FiltroOpcion,
  FormatoRow,
  GestionMencionRow,
  HeatCell,
  IndustriaRow,
  Kpis,
  NacionalInteriorRow,
  NotaDestacada,
  OrganicaPagaRow,
  PrensaFilters,
  ProvinciaRow,
  RankedRow,
  SemanaRow,
  TierRow,
  TipoMedioRow,
  VapTierRow,
  VapTipoMedioRow,
} from "@/lib/reports/prensa";
import { F, isNum } from "./format";
import "./pr.css";

// Reporte nuevo (lee de Supabase) con el diseño portado del artifact de
// referencia "Adecco Prensa Moscú" — ver app/reportes/prensa/pr.css. Mismo
// patrón que app/reportes/influencers con su referencia.
type Identity = { email?: string | null; token?: string | null };

const PAGES = [
  { id: "aporte", label: "Aporte propio" },
  { id: "geografia", label: "Distribución geográfica" },
  { id: "gestion", label: "Gestión de repercusiones" },
  { id: "detalle", label: "Detalle" },
  { id: "competencia", label: "Competencia" },
] as const;
type PageId = (typeof PAGES)[number]["id"];

const DONUT_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--sx)"];
const TIER_COLORS = ["var(--acc)", "var(--s1)", "var(--s3)"];

function qs(basePath: string, filters: PrensaFilters, id: Identity): string {
  const p = new URLSearchParams();
  if (id.email) p.set("u", id.email);
  if (id.token) p.set("t", id.token);
  if (filters.desde) p.set("desde", filters.desde);
  if (filters.hasta) p.set("hasta", filters.hasta);
  if (filters.industria) p.set("industria", filters.industria);
  if (filters.campana) p.set("campana", filters.campana);
  if (filters.tipoMedio) p.set("medio", filters.tipoMedio);
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}
function setHref(basePath: string, filters: PrensaFilters, id: Identity, key: keyof PrensaFilters, value: string | null) {
  return qs(basePath, { ...filters, [key]: value }, id);
}
function toggleHref(basePath: string, filters: PrensaFilters, id: Identity, key: keyof PrensaFilters, value: string) {
  return qs(basePath, { ...filters, [key]: filters[key] === value ? null : value }, id);
}
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
function weekLabel(iso: string) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}
type Props = {
  filters: PrensaFilters;
  kpis: Kpis | null;
  semanal: SemanaRow[];
  porTier: TierRow[];
  destacadas: NotaDestacada[];
  porTipoMedio: TipoMedioRow[];
  porFormato: FormatoRow[];
  topVoceros: RankedRow[];
  topMedios: RankedRow[];
  topPeriodistas: RankedRow[];
  actividad: HeatCell[];
  nacionalInterior: NacionalInteriorRow[];
  provincias: ProvinciaRow[];
  porIndustria: IndustriaRow[];
  porCampana: CampanaRow[];
  gestionMencion: GestionMencionRow[];
  organicaPaga: OrganicaPagaRow[];
  vapPorTipoMedio: VapTipoMedioRow[];
  vapPorTier: VapTierRow[];
  detalle: DetalleRow[];
  opciones: FiltroOpcion[];
  fontClassName: string;
  basePath: string;
  email?: string | null;
  token?: string | null;
};

export default function PrensaDashboard({
  filters,
  kpis,
  semanal,
  porTier,
  destacadas,
  porTipoMedio,
  porFormato,
  topVoceros,
  topMedios,
  topPeriodistas,
  actividad,
  nacionalInterior,
  provincias,
  porIndustria,
  porCampana,
  gestionMencion,
  organicaPaga,
  vapPorTipoMedio,
  vapPorTier,
  detalle,
  opciones,
  fontClassName,
  basePath,
  email,
  token,
}: Props) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [page, setPage] = useState<PageId>("aporte");
  const rootRef = useRef<HTMLDivElement>(null);
  const id: Identity = { email, token };

  const go = (href: string) => router.push(href, { scroll: false });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      try {
        window.parent?.postMessage({ type: "softr-iframe-resize", height: el.scrollHeight }, "*");
      } catch {}
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [page]);

  const industrias = useMemo(() => opciones.filter((o) => o.dimension === "industria").map((o) => o.valor), [opciones]);
  const campanas = useMemo(() => opciones.filter((o) => o.dimension === "campana").map((o) => o.valor), [opciones]);
  const hayFiltros = !!(filters.industria || filters.campana || filters.tipoMedio);
  const totalMedios = useMemo(() => porTipoMedio.reduce((a, r) => a + r.notas, 0), [porTipoMedio]);

  return (
    <div ref={rootRef} className={`pr ${fontClassName}`} data-theme={theme}>
      <div className="pr-wrap">
        <div className="pr-top">
          <div>
            <div className="pr-kicker">MOSCÚ · FRAMEWORK DESK</div>
            <h1 className="pr-title">{F.text(kpis?.marca)} en los medios</h1>
          </div>
          <div className="pr-theme" role="group" aria-label="Tema">
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
              Oscura
            </button>
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
              Clara
            </button>
          </div>
        </div>

        <div className="pr-pages" role="tablist">
          {PAGES.map((p) => (
            <button key={p.id} type="button" aria-selected={page === p.id} role="tab" onClick={() => setPage(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="pr-sub">
          Cobertura de prensa {filters.desde && filters.hasta ? `del ${F.date(filters.desde)} al ${F.date(filters.hasta)}` : "completa"}.
        </p>

        <Hero kpis={kpis} />

        <div className="pr-mt" role="tablist" aria-label="Tipo de medio">
          <button type="button" aria-pressed={!filters.tipoMedio} onClick={() => go(setHref(basePath, filters, id, "tipoMedio", null))}>
            Todos <em>{F.int(totalMedios)}</em>
          </button>
          {porTipoMedio.map((r) => (
            <button
              key={r.tipo_de_medio}
              type="button"
              aria-pressed={filters.tipoMedio === r.tipo_de_medio}
              onClick={() => go(toggleHref(basePath, filters, id, "tipoMedio", r.tipo_de_medio))}
            >
              {FMT_TIPO_MEDIO[r.tipo_de_medio] ?? r.tipo_de_medio} <em>{F.int(r.notas)}</em>
            </button>
          ))}
        </div>

        <div className="pr-filters">
          <div className="pr-fld">
            <label htmlFor="pr-desde">Desde</label>
            <input id="pr-desde" type="date" defaultValue={filters.desde ?? ""} onChange={(e) => go(setHref(basePath, filters, id, "desde", e.target.value || null))} />
          </div>
          <div className="pr-fld">
            <label htmlFor="pr-hasta">Hasta</label>
            <input id="pr-hasta" type="date" defaultValue={filters.hasta ?? ""} onChange={(e) => go(setHref(basePath, filters, id, "hasta", e.target.value || null))} />
          </div>
          <div className="pr-fld grow">
            <label htmlFor="pr-industria">Industria</label>
            <select id="pr-industria" value={filters.industria ?? ""} onChange={(e) => go(setHref(basePath, filters, id, "industria", e.target.value || null))}>
              <option value="">Todas las industrias</option>
              {industrias.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="pr-fld grow">
            <label htmlFor="pr-campana">Campaña</label>
            <select id="pr-campana" value={filters.campana ?? ""} onChange={(e) => go(setHref(basePath, filters, id, "campana", e.target.value || null))}>
              <option value="">Todas las campañas</option>
              {campanas.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {(hayFiltros || filters.industria || filters.campana) && (
            <button type="button" className="pr-ghost" onClick={() => go(setHref(basePath, { ...filters, industria: null, campana: null, tipoMedio: null }, id, "industria", null))}>
              Limpiar filtros
            </button>
          )}
        </div>

        {page === "aporte" && (
          <div className="pr-grid">
            <EvolucionSemanal data={semanal} />
            <PorTier data={porTier} />
            <NotasDestacadas data={destacadas} />
            <PorTipoMedio data={porTipoMedio} total={totalMedios} />
            <PorFormato data={porFormato} />
            <TopLista titulo="Top voceros" nota="Por cantidad de notas dentro de los filtros." data={topVoceros.slice(0, 8)} />
            <TopLista titulo="Top medios" nota="Por cantidad de notas dentro de los filtros." data={topMedios.slice(0, 8)} />
            <TopLista titulo="Top periodistas" nota="Por cantidad de notas dentro de los filtros." data={topPeriodistas.slice(0, 8)} />
            <Actividad data={actividad} />
          </div>
        )}
        {page === "geografia" && (
          <div className="pr-grid">
            <NacionalInterior data={nacionalInterior} />
            <Provincias data={provincias} />
            <PorIndustria data={porIndustria} />
            <PorCampana data={porCampana} />
          </div>
        )}
        {page === "gestion" && (
          <div className="pr-grid">
            <GestionMencion data={gestionMencion} />
            <OrganicaPaga data={organicaPaga} />
            <VapPorTipoMedio data={vapPorTipoMedio} />
            <VapPorTier data={vapPorTier} />
            <RankingTable medios={topMedios} periodistas={topPeriodistas} />
          </div>
        )}
        {page === "detalle" && <Detalle data={detalle} />}
        {page === "competencia" && (
          <div className="pr-grid">
            <ParticipacionCompetencia />
          </div>
        )}
      </div>
    </div>
  );
}

const FMT_TIPO_MEDIO: Record<string, string> = {
  PORTAL: "Portal",
  IMPRESO: "Impreso",
  RRSS: "RRSS",
  RADIO: "Radio",
  STREAMING: "Streaming",
  TV: "TV",
};

function Hero({ kpis }: { kpis: Kpis | null }) {
  if (!kpis) return null;
  return (
    <div className="pr-hero">
      <div className="pr-hid">
        <span className="dot">{F.text(kpis.marca).slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{F.text(kpis.marca)}</b>
          <span>Cobertura de prensa y performance en un solo lugar</span>
        </div>
      </div>
      <div className="pr-kpis">
        <Kpi n="Repercusiones" v={F.int(kpis.notas)} s={`${F.int(kpis.medios)} medios distintos`} />
        <Kpi n="Reach" v={F.compact(kpis.reach)} s="audiencia potencial" />
        <Kpi n="VAP" v={F.moneyc(kpis.vap)} s="valor publicitario" />
        <Kpi n="Tier 1" v={F.pct(kpis.pct_tier1)} s={`${F.int(kpis.tier1_notas)} notas en medios masivos`} />
        <Kpi n="Gestión" v={F.pct(kpis.pct_gestion)} s="notas por acción de prensa" />
      </div>
      <span className="pr-note" style={{ position: "relative", zIndex: 1, color: "#9a9a9a" }}>
        Sin período previo para comparar.
      </span>
    </div>
  );
}
function Kpi({ n, v, s }: { n: string; v: string; s: string }) {
  return (
    <div className="pr-kpi">
      <div className="n">{n}</div>
      <div className="v">{v}</div>
      <div className="n">{s}</div>
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

function EvolucionSemanal({ data }: { data: SemanaRow[] }) {
  const [metric, setMetric] = useState<"notas" | "reach">("notas");
  const [wrapRef, width] = useBoxWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.filter((d) => isNum(d[metric]));

  return (
    <div className="pr-card">
      <div className="pr-head">
        <h2>Evolución semanal</h2>
        <div className="pr-seg" role="group" aria-label="Métrica">
          <button type="button" aria-pressed={metric === "notas"} onClick={() => setMetric("notas")}>
            Notas
          </button>
          <button type="button" aria-pressed={metric === "reach"} onClick={() => setMetric("reach")}>
            Reach
          </button>
        </div>
      </div>
      {!pts.length ? (
        <div className="pr-empty">Sin datos para este período.</div>
      ) : (
        <div ref={wrapRef} className="pr-box" style={{ position: "relative" }}>
          <LineChart pts={pts} metric={metric} width={width} hover={hover} setHover={setHover} />
        </div>
      )}
    </div>
  );
}

function LineChart({
  pts,
  metric,
  width,
  hover,
  setHover,
}: {
  pts: SemanaRow[];
  metric: "notas" | "reach";
  width: number;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const W = width,
    H = 250,
    top = 10,
    bottom = 26;
  const vals = pts.map((p) => p[metric] as number);
  const maxY = Math.max(1, ...vals) * 1.1;
  const yt = ticks(maxY, 5);
  const fmtTick = metric === "notas" ? (v: number) => F.int(v) : (v: number) => F.compact(v);
  const left = Math.max(...yt.map((v) => fmtTick(v).length), 2) * 6.5 + 16;
  const right = 12;
  const n = pts.length;
  const xAt = (i: number) => (n > 1 ? left + (i / (n - 1)) * (W - left - right) : (left + W - right) / 2);
  const yAt = (v: number) => H - bottom - (Math.max(0, v) / maxY) * (H - bottom - top);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p[metric] as number).toFixed(1)}`).join(" ");
  const areaPath =
    `M ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} ` +
    pts.map((p, i) => `L ${xAt(i).toFixed(1)} ${yAt(p[metric] as number).toFixed(1)}`).join(" ") +
    ` L ${xAt(n - 1).toFixed(1)} ${yAt(0).toFixed(1)} Z`;
  const maxLabelW = Math.max(...pts.map((p) => weekLabel(p.semana).length), 1) * 6.5;
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
    <>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <g className="pr-axis">
          {yt.map((v) => (
            <line key={v} x1={left} x2={W - 4} y1={yAt(v)} y2={yAt(v)} />
          ))}
          {yt.map((v) => (
            <text key={v} x={left - 8} y={yAt(v)} dy="0.35em" textAnchor="end">
              {fmtTick(v)}
            </text>
          ))}
        </g>
        {pts
          .map((_, i) => i)
          .filter((i) => i % step === 0)
          .map((i) => (
            <text key={pts[i].semana} x={xAt(i)} y={H - 6} textAnchor="middle" className="pr-axis" style={{ fontSize: 11 }}>
              {weekLabel(pts[i].semana)}
            </text>
          ))}
        <path d={areaPath} fill="var(--acc)" opacity={0.14} />
        <path d={linePath} fill="none" stroke="var(--acc)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        {hoverPt && <circle cx={xAt(hover as number)} cy={yAt(hoverPt[metric] as number)} r={5} fill="var(--acc)" stroke="var(--card)" strokeWidth={2} />}
        <rect x={left} y={0} width={Math.max(0, W - left)} height={H} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hoverPt && (
        <div className="pr-tip" style={{ left: Math.max(0, Math.min(W - 150, xAt(hover as number) + 12)), top: yAt(hoverPt[metric] as number) + 14 }}>
          <div className="pr-tip-h">Semana del {weekLabel(hoverPt.semana)}</div>
          <div>{metric === "notas" ? F.int(hoverPt.notas) + " notas" : F.compact(hoverPt.reach) + " de reach"}</div>
        </div>
      )}
    </>
  );
}

// ---------- donut genérico (tier, industria) ----------
function Donut({ segments, centerLabel, centerSub }: { segments: { label: string; value: number; color: string }[]; centerLabel: string; centerSub: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <div className="pr-empty">Sin datos.</div>;
  const R = 52,
    STROKE = 22,
    C = 2 * Math.PI * R;
  const arcs = segments
    .filter((s) => s.value > 0)
    .reduce<{ label: string; value: number; color: string; dash: string; offset: number; frac: number; acc: number }[]>((out, s) => {
      const prevAcc = out.length ? out[out.length - 1].acc : 0;
      const frac = s.value / total;
      const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
      out.push({ ...s, dash, offset: -prevAcc * C, frac, acc: prevAcc + frac });
      return out;
    }, []);
  return (
    <div className="pr-donut">
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
        {arcs.map((a) => (
          <circle key={a.label} cx={70} cy={70} r={R} fill="none" stroke={a.color} strokeWidth={STROKE} strokeDasharray={a.dash} strokeDashoffset={a.offset} />
        ))}
      </svg>
      <div style={{ marginTop: -94, marginBottom: 54, textAlign: "center" }}>
        <div className="pr-donut-center">{centerLabel}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)" }}>{centerSub}</div>
      </div>
      <div className="pr-dlegend">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
              <b>
                {F.int(s.value)} · {F.pct((100 * s.value) / total)}
              </b>
            </span>
          ))}
      </div>
    </div>
  );
}

function PorTier({ data }: { data: TierRow[] }) {
  const total = data.reduce((a, d) => a + d.notas, 0);
  return (
    <div className="pr-card">
      <h2>Repercusiones por tier</h2>
      <p>Tier 1 son medios masivos y Tier 3 regionales o de nicho.</p>
      <Donut
        segments={data.map((d, i) => ({ label: `Tier ${d.tier}`, value: d.notas, color: TIER_COLORS[i % TIER_COLORS.length] }))}
        centerLabel={F.int(total)}
        centerSub="notas"
      />
    </div>
  );
}

function NotasDestacadas({ data }: { data: NotaDestacada[] }) {
  return (
    <div className="pr-card wide">
      <h2>Notas destacadas</h2>
      <p>Las de mayor reach dentro de los filtros, de medios distintos.</p>
      {!data.length ? (
        <div className="pr-empty">Sin notas para este período.</div>
      ) : (
        <div className="pr-feat">
          {data.map((n, i) => (
            <a key={i} className="pr-fi" href={n.url ?? undefined} target="_blank" rel="noreferrer">
              <span className="medio">{n.medio}</span>
              <b>{F.text(n.tema)}</b>
              <span className="k">
                <span>{F.compact(n.reach)} reach</span>
                <span>{F.date(n.fecha)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function PorTipoMedio({ data, total }: { data: TipoMedioRow[]; total: number }) {
  if (!data.length) return (
    <div className="pr-card">
      <h2>Repercusiones por tipo de medio</h2>
      <div className="pr-empty">Sin datos.</div>
    </div>
  );
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Repercusiones por tipo de medio</h2>
      <ul className="pr-rank">
        {data.map((d) => {
          const pct = Math.max(2, (100 * d.notas) / max);
          return (
            <li key={d.tipo_de_medio}>
              <div className="row">
                <span className="nm">{FMT_TIPO_MEDIO[d.tipo_de_medio] ?? d.tipo_de_medio}</span>
                <span className="bar">
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="ct">{F.pct((100 * d.notas) / Math.max(1, total))}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- columnas verticales genérico ----------
function ColumnChart({ data, fmt, height = 220 }: { data: { label: string; value: number }[]; fmt: (v: number) => string; height?: number }) {
  const [wrapRef, width] = useBoxWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="pr-empty">Sin datos.</div>;

  const W = width,
    H = height,
    top = 8,
    bottom = 24;
  const maxY = Math.max(1, ...data.map((p) => p.value)) * 1.08;
  const yt = ticks(maxY, 4);
  const tick = (v: number) => fmt(v);
  const left = Math.max(...yt.map((v) => tick(v).length), 2) * 6.5 + 14;
  const n = data.length;
  const gap = (W - left - 4) / n;
  const bw = Math.max(8, Math.min(60, gap * 0.5));
  const xAt = (i: number) => left + i * gap + (gap - bw) / 2;
  const yAt = (v: number) => H - bottom - (Math.max(0, v) / maxY) * (H - bottom - top);

  return (
    <div ref={wrapRef} className="pr-box short" style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <g className="pr-axis">
          {yt.map((v) => (
            <line key={v} x1={left} x2={W} y1={yAt(v)} y2={yAt(v)} />
          ))}
          {yt.map((v) => (
            <text key={v} x={left - 8} y={yAt(v)} dy="0.35em" textAnchor="end">
              {tick(v)}
            </text>
          ))}
        </g>
        {data.map((p, i) => (
          <text key={p.label} x={xAt(i) + bw / 2} y={H - 6} textAnchor="middle" className="pr-axis" style={{ fontSize: 11 }}>
            {p.label}
          </text>
        ))}
        {data.map((p, i) => (
          <rect
            key={p.label}
            x={xAt(i)}
            width={bw}
            y={yAt(Math.max(0, p.value))}
            height={Math.max(0, yAt(0) - yAt(Math.max(0, p.value)))}
            rx={Math.min(4, bw / 2)}
            fill="var(--acc)"
            onMouseMove={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover != null && (
        <div className="pr-tip" style={{ left: Math.max(0, Math.min(W - 150, xAt(hover) + bw / 2 + 12)), top: Math.max(0, yAt(data[hover].value) - 34) }}>
          <div>{fmt(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}

function PorFormato({ data }: { data: FormatoRow[] }) {
  return (
    <div className="pr-card">
      <h2>Repercusiones por formato</h2>
      <ColumnChart data={data.map((d) => ({ label: d.formato, value: d.notas }))} fmt={F.int} />
    </div>
  );
}

function Bars({ rows }: { rows: { nombre: string; valor: number; etiqueta: string }[] }) {
  if (!rows.length) return <div className="pr-empty">Sin datos.</div>;
  const max = Math.max(1, ...rows.map((r) => r.valor));
  return (
    <ul className="pr-rank">
      {rows.map((r) => (
        <li key={r.nombre}>
          <div className="row">
            <span className="nm">{r.nombre}</span>
            <span className="bar">
              <i style={{ width: `${Math.max(2, (100 * r.valor) / max)}%` }} />
            </span>
            <span className="ct">{r.etiqueta}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopLista({ titulo, nota, data }: { titulo: string; nota: string; data: RankedRow[] }) {
  return (
    <div className="pr-card">
      <h2>{titulo}</h2>
      <p>{nota}</p>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.nombre, valor: d.notas, etiqueta: F.int(d.notas) }))} />
      </div>
    </div>
  );
}

const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function Actividad({ data }: { data: HeatCell[] }) {
  const { semanas, lookup, max } = useMemo(() => {
    const semanasSet = new Set<string>();
    const lookup = new Map<string, number>();
    let max = 0;
    for (const c of data) {
      semanasSet.add(c.semana);
      lookup.set(`${c.semana}|${c.dow}`, c.notas);
      if (c.notas > max) max = c.notas;
    }
    return { semanas: [...semanasSet].sort(), lookup, max };
  }, [data]);

  if (!semanas.length) {
    return (
      <div className="pr-card">
        <h2>Días de mayor actividad</h2>
        <div className="pr-empty">Sin datos para este período.</div>
      </div>
    );
  }

  return (
    <div className="pr-card">
      <div className="pr-head">
        <h2>Días de mayor actividad</h2>
        <div className="pr-hl">
          Menos <i /> Más
        </div>
      </div>
      <p>Notas por día. Cada columna es una semana.</p>
      <div className="pr-heat">
        <div className="pr-hrow">
          <div className="pr-hd">
            {DOW_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="pr-hg">
            {semanas.map((s) =>
              [1, 2, 3, 4, 5, 6, 7].map((dow) => {
                const v = lookup.get(`${s}|${dow}`) ?? 0;
                const alpha = max > 0 ? 0.08 + 0.72 * (v / max) : 0.08;
                return <div key={`${s}-${dow}`} className="pr-hc" title={`${weekLabel(s)} · ${DOW_LABELS[dow - 1]}: ${v} notas`} style={v > 0 ? { background: `rgba(255,79,46,${alpha})` } : undefined} />;
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NacionalInterior({ data }: { data: NacionalInteriorRow[] }) {
  const ordered = [...data].sort((a, b) => a.tipo.localeCompare(b.tipo));
  return (
    <div className="pr-card">
      <h2>Nacional e interior</h2>
      <ColumnChart data={ordered.map((d) => ({ label: d.tipo === "NACIONAL" ? "Nacional" : "Interior", value: d.notas }))} fmt={F.int} />
    </div>
  );
}

function Provincias({ data }: { data: ProvinciaRow[] }) {
  const top = data.slice(0, 10);
  return (
    <div className="pr-card">
      <h2>Provincias</h2>
      <p>
        Top 10 de {data.length} provincias. Buenos Aires incluye CABA y el conurbano.
      </p>
      <div className="pr-rank scroll">
        <Bars rows={top.map((d) => ({ nombre: d.provincia, valor: d.notas, etiqueta: F.int(d.notas) }))} />
      </div>
    </div>
  );
}

function PorIndustria({ data }: { data: IndustriaRow[] }) {
  const sorted = [...data].sort((a, b) => b.notas - a.notas);
  const top = sorted.slice(0, 7);
  const restoNotas = sorted.slice(7).reduce((a, d) => a + d.notas, 0);
  const segments = top.map((d, i) => ({ label: d.industria, value: d.notas, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  if (restoNotas > 0) segments.push({ label: "Otras", value: restoNotas, color: "var(--sx)" });
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="pr-card">
      <h2>Repercusiones por industria</h2>
      <Donut segments={segments} centerLabel={F.int(total)} centerSub="notas" />
    </div>
  );
}

function PorCampana({ data }: { data: CampanaRow[] }) {
  return (
    <div className="pr-card wide">
      <h2>Repercusiones por campaña</h2>
      <p>Lista completa con desplazamiento.</p>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.campana, valor: d.notas, etiqueta: F.int(d.notas) }))} />
      </div>
    </div>
  );
}

function GestionMencion({ data }: { data: GestionMencionRow[] }) {
  const ordered = [...data].sort((a, b) => b.notas - a.notas);
  return (
    <div className="pr-card">
      <h2>Gestiones y menciones</h2>
      <p>Gestión es una nota que sale de una acción de prensa. Mención es una aparición colateral.</p>
      <ColumnChart data={ordered.map((d) => ({ label: d.tipo === "GESTIÓN" ? "Gestión" : "Mención", value: d.notas }))} fmt={F.int} />
    </div>
  );
}

function OrganicaPaga({ data }: { data: OrganicaPagaRow[] }) {
  const organica = data.find((d) => d.tipo === "ORGÁNICA");
  const paga = data.find((d) => d.tipo === "PAGA");
  const total = data.reduce((a, d) => a + d.notas, 0) || 1;
  return (
    <div className="pr-card">
      <h2>Orgánica y paga</h2>
      <div className="pr-stat2">
        <div className="blk">
          <span className="lbl">Orgánicas</span>
          <span className="v">{F.int(organica?.notas ?? 0)}</span>
          <span className="n">{F.pct((100 * (organica?.notas ?? 0)) / total)} de las notas</span>
        </div>
        <div className="blk">
          <span className="lbl">Pagas</span>
          <span className="v">{F.int(paga?.notas ?? 0)}</span>
          <span className="n">Inversión cargada: {F.money((organica?.inversion ?? 0) + (paga?.inversion ?? 0))}</span>
        </div>
      </div>
      {(organica?.inversion ?? 0) + (paga?.inversion ?? 0) === 0 && (
        <div className="pr-empty">
          La grilla no registra inversión paga en ninguna nota. Cuando se cargue, aparecerá acá y en la tabla de detalle.
        </div>
      )}
    </div>
  );
}

function VapPorTipoMedio({ data }: { data: VapTipoMedioRow[] }) {
  const ordered = [...data].sort((a, b) => b.vap - a.vap);
  return (
    <div className="pr-card">
      <h2>VAP por tipo de medio</h2>
      <p>En millones de pesos.</p>
      <Bars rows={ordered.map((d) => ({ nombre: FMT_TIPO_MEDIO[d.tipo_de_medio] ?? d.tipo_de_medio, valor: d.vap, etiqueta: F.mm(d.vap) }))} />
    </div>
  );
}

function VapPorTier({ data }: { data: VapTierRow[] }) {
  const ordered = [...data].sort((a, b) => a.tier - b.tier);
  return (
    <div className="pr-card">
      <h2>VAP por tier</h2>
      <p>En millones de pesos.</p>
      <Bars rows={ordered.map((d) => ({ nombre: `Tier ${d.tier}`, valor: d.vap, etiqueta: F.mm(d.vap) }))} />
    </div>
  );
}

type SortKey = "notas" | "reach" | "vap";

function RankingTable({ medios, periodistas }: { medios: RankedRow[]; periodistas: RankedRow[] }) {
  const [which, setWhich] = useState<"medios" | "periodistas">("medios");
  const [sortKey, setSortKey] = useState<SortKey>("notas");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const rows = which === "medios" ? medios : periodistas;
  const sorted = useMemo(() => [...rows].sort((a, b) => sortDir * (a[sortKey] - b[sortKey])), [rows, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  };
  const th = (k: SortKey, label: string) => (
    <th className="r" onClick={() => onSort(k)}>
      <span className="pr-sortable">
        {label} {sortKey === k ? (sortDir === -1 ? "▾" : "▴") : ""}
      </span>
    </th>
  );

  return (
    <div className="pr-card wide">
      <div className="pr-head">
        <div>
          <h2>Detalle</h2>
          <p>Hacé clic en un encabezado para ordenar.</p>
        </div>
        <div className="pr-seg" role="group">
          <button type="button" aria-pressed={which === "medios"} onClick={() => setWhich("medios")}>
            Medios
          </button>
          <button type="button" aria-pressed={which === "periodistas"} onClick={() => setWhich("periodistas")}>
            Periodistas
          </button>
        </div>
      </div>
      {!sorted.length ? (
        <div className="pr-empty">Sin datos.</div>
      ) : (
        <div className="pr-tbl">
          <table>
            <thead>
              <tr>
                <th>{which === "medios" ? "Medio" : "Periodista"}</th>
                {th("notas", "Notas")}
                {th("reach", "Reach")}
                {th("vap", "VAP")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.nombre}>
                  <td>{r.nombre}</td>
                  <td className="num r">{F.int(r.notas)}</td>
                  <td className="num r">{F.compact(r.reach)}</td>
                  <td className="num r">{F.moneyc(r.vap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detalle({ data }: { data: DetalleRow[] }) {
  const [mencion, setMencion] = useState<string | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [tipoMedio, setTipoMedio] = useState<string | null>(null);
  const [formato, setFormato] = useState<string | null>(null);
  const [soloConLink, setSoloConLink] = useState(false);
  const [busq, setBusq] = useState("");
  const [visibles, setVisibles] = useState(50);

  const opciones = useMemo(() => {
    const tiers = [...new Set(data.map((r) => r.tier).filter((v): v is number => v != null))].sort();
    const tipos = [...new Set(data.map((r) => r.tipo_de_medio).filter((v): v is string => !!v))].sort();
    const formatos = [...new Set(data.map((r) => r.formato).filter((v): v is string => !!v))].sort();
    return { tiers, tipos, formatos };
  }, [data]);

  const filtradas = useMemo(() => {
    const q = busq.trim().toLowerCase();
    return data.filter((r) => {
      if (soloConLink && !r.url) return false;
      if (mencion && r.mencion_gestion !== mencion) return false;
      if (tier && r.tier !== tier) return false;
      if (tipoMedio && r.tipo_de_medio !== tipoMedio) return false;
      if (formato && r.formato !== formato) return false;
      if (q && !`${r.tema ?? ""} ${r.medio} ${r.periodista ?? ""} ${r.vocero ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, mencion, tier, tipoMedio, formato, soloConLink, busq]);

  const conLink = filtradas.filter((r) => r.url).length;
  const reachTotal = filtradas.reduce((a, r) => a + (r.reach ?? 0), 0);
  const vapTotal = filtradas.reduce((a, r) => a + (r.vap ?? 0), 0);
  const visibleRows = filtradas.slice(0, visibles);

  return (
    <div className="pr-grid">
      <div className="pr-card wide">
        <div className="pr-facets">
          <div className="pr-facet">
            <span>Mención/Gestión</span>
            <div className="opts">
              {["GESTIÓN", "MENCIÓN"].map((v) => (
                <button key={v} type="button" aria-pressed={mencion === v} onClick={() => setMencion((c) => (c === v ? null : v))}>
                  {v === "GESTIÓN" ? "Gestión" : "Mención"}
                </button>
              ))}
            </div>
          </div>
          <div className="pr-facet">
            <span>Tier</span>
            <div className="opts">
              {opciones.tiers.map((v) => (
                <button key={v} type="button" aria-pressed={tier === v} onClick={() => setTier((c) => (c === v ? null : v))}>
                  Tier {v}
                </button>
              ))}
            </div>
          </div>
          <div className="pr-facet">
            <span>Tipo de medio</span>
            <div className="opts">
              {opciones.tipos.map((v) => (
                <button key={v} type="button" aria-pressed={tipoMedio === v} onClick={() => setTipoMedio((c) => (c === v ? null : v))}>
                  {FMT_TIPO_MEDIO[v] ?? v}
                </button>
              ))}
            </div>
          </div>
          <div className="pr-facet">
            <span>Formato</span>
            <div className="opts">
              {opciones.formatos.map((v) => (
                <button key={v} type="button" aria-pressed={formato === v} onClick={() => setFormato((c) => (c === v ? null : v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pr-search" style={{ marginTop: 12 }}>
          <input type="text" placeholder="Filtrar por tema, medio, periodista o vocero" value={busq} onChange={(e) => setBusq(e.target.value)} />
          <select value={soloConLink ? "con" : "todas"} onChange={(e) => setSoloConLink(e.target.value === "con")}>
            <option value="todas">Con y sin enlace</option>
            <option value="con">Solo con enlace</option>
          </select>
        </div>

        <p className="pr-note" style={{ marginTop: 10 }}>
          {F.int(filtradas.length)} notas · {F.int(conLink)} con enlace · reach {F.compact(reachTotal)} · VAP {F.moneyc(vapTotal)}
        </p>

        {!filtradas.length ? (
          <div className="pr-empty">Sin notas para estos filtros.</div>
        ) : (
          <>
            <div className="pr-tbl">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nota</th>
                    <th>Medio</th>
                    <th>Periodista</th>
                    <th>Vocero</th>
                    <th className="r">Reach</th>
                    <th className="r">VAP</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{F.date(r.fecha)}</td>
                      <td className="pr-ttl">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            {F.text(r.tema)}
                          </a>
                        ) : (
                          F.text(r.tema)
                        )}
                        <div className="pr-tag">
                          {r.tier ? `T${r.tier}` : ""} · {FMT_TIPO_MEDIO[r.tipo_de_medio ?? ""] ?? r.tipo_de_medio} · {r.formato}
                        </div>
                      </td>
                      <td>{r.medio}</td>
                      <td>{F.text(r.periodista)}</td>
                      <td>{F.text(r.vocero)}</td>
                      <td className="num r">{F.compact(r.reach)}</td>
                      <td className="num r">{F.moneyc(r.vap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibles < filtradas.length && (
              <button type="button" className="pr-more" onClick={() => setVisibles((v) => v + 50)}>
                Mostrar 50 más ({filtradas.length - visibles} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ParticipacionCompetencia() {
  return (
    <div className="pr-card wide pr-pending">
      <span className="tag">Pendiente</span>
      <h2>Participación frente a Manpower y Randstad</h2>
      <p>
        Reparto entre las tres consultoras con las hojas de seguimiento de la competencia. Usa el rango de meses de
        los filtros de fecha y no los demás filtros.
      </p>
      <p className="pr-note">
        Esta sección necesita la hoja de seguimiento de la competencia (Manpower/Randstad) como fuente — todavía no
        está cargada en Supabase/Fabric, así que queda pendiente hasta tenerla.
      </p>
    </div>
  );
}
