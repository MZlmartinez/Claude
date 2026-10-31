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
  const rootRef = useRef<HTMLDivElement>(null);
  const id: Identity = { email, token };

  const go = (href: string) => router.push(href, { scroll: false });

  // Le avisa a Softr cuánto mide el contenido real, para que el iframe se
  // ajuste sin scroll propio (mismo patrón que el resto de los reportes).
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
  }, []);

  const industrias = useMemo(() => opciones.filter((o) => o.dimension === "industria").map((o) => o.valor), [opciones]);
  const campanas = useMemo(() => opciones.filter((o) => o.dimension === "campana").map((o) => o.valor), [opciones]);
  const hayFiltros = !!(filters.desde || filters.hasta || filters.industria || filters.campana || filters.tipoMedio);

  return (
    <div ref={rootRef} className={`pr ${fontClassName}`} data-theme={theme}>
      <div className="pr-wrap">
        <div className="pr-top">
          <div>
            <div className="pr-kicker">MOSCÚ · FRAMEWORK DESK</div>
            <h1 className="pr-title">{F.text(kpis?.marca)} en los medios</h1>
            <p className="pr-sub">Cobertura de prensa y performance en un solo lugar.</p>
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
              <option value="">Todas</option>
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
              <option value="">Todas</option>
              {campanas.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {hayFiltros && (
            <button type="button" className="pr-ghost" onClick={() => go(qs(basePath, { desde: null, hasta: null, industria: null, campana: null, tipoMedio: null }, id))}>
              Limpiar filtros
            </button>
          )}
        </div>

        {filters.tipoMedio && (
          <div className="pr-active">
            <button type="button" className="pr-pill" onClick={() => go(setHref(basePath, filters, id, "tipoMedio", null))}>
              <b>Tipo de medio:</b> {filters.tipoMedio} ✕
            </button>
          </div>
        )}

        <Hero kpis={kpis} />

        <div className="pr-grid">
          <EvolucionSemanal data={semanal} />
          <PorTier data={porTier} />
          <NotasDestacadas data={destacadas} />
          <PorTipoMedio data={porTipoMedio} filters={filters} basePath={basePath} id={id} go={go} />
          <PorFormato data={porFormato} />
          <TopLista titulo="Top voceros" nota="Por cantidad de notas dentro de los filtros." data={topVoceros} />
          <TopLista titulo="Top medios" nota="Por cantidad de notas dentro de los filtros." data={topMedios} />
          <TopLista titulo="Top periodistas" nota="Por cantidad de notas dentro de los filtros." data={topPeriodistas} />
          <Actividad data={actividad} />
          <NacionalInterior data={nacionalInterior} />
          <Provincias data={provincias} />
          <PorIndustria data={porIndustria} />
          <PorCampana data={porCampana} />
          <GestionMencion data={gestionMencion} />
          <OrganicaPaga data={organicaPaga} />
          <VapPorTipoMedio data={vapPorTipoMedio} />
          <VapPorTier data={vapPorTier} />
          <Detalle data={detalle} />
          <ParticipacionCompetencia />
        </div>

        <p className="pr-foot">
          Datos sincronizados diariamente desde Fabric. VAP: valor publicitario equivalente. Reach: alcance estimado de cada nota.
        </p>
      </div>
    </div>
  );
}

function Hero({ kpis }: { kpis: Kpis | null }) {
  if (!kpis) return null;
  return (
    <div className="pr-hero">
      <div className="pr-hid">
        <span className="dot">P</span>
        <div>
          <b>
            {F.int(kpis.notas)} notas · {F.compact(kpis.reach)} de reach
          </b>
          <span>
            {kpis.desde && kpis.hasta ? `Entre ${F.date(kpis.desde)} y ${F.date(kpis.hasta)}` : "Período completo"} · {F.int(kpis.medios)} medios distintos
          </span>
        </div>
      </div>
      <div className="pr-kpis">
        <Kpi n="Notas" v={F.int(kpis.notas)} />
        <Kpi n="Medios distintos" v={F.int(kpis.medios)} />
        <Kpi n="Reach total" v={F.compact(kpis.reach)} />
        <Kpi n="VAP total" v={F.moneyc(kpis.vap)} />
        <Kpi n="Gestión propia" v={F.pct(kpis.pct_gestion)} />
        <Kpi n="Alcance nacional" v={F.pct(kpis.pct_nacional)} />
      </div>
    </div>
  );
}
function Kpi({ n, v }: { n: string; v: string }) {
  return (
    <div className="pr-kpi">
      <div className="n">{n}</div>
      <div className="v">{v}</div>
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
    <div className="pr-card wide">
      <div className="pr-head">
        <div>
          <h2>Evolución semanal</h2>
          <p>Notas publicadas por semana dentro de los filtros.</p>
        </div>
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

function Bars({ rows, max }: { rows: { nombre: string; valor: number; onClick?: () => void; activo?: boolean }[]; max: number }) {
  if (!rows.length) return <div className="pr-empty">Sin datos.</div>;
  return (
    <ul className="pr-rank">
      {rows.map((r) => {
        const pct = max > 0 ? Math.max(2, (100 * r.valor) / max) : 0;
        const content = (
          <>
            <span className="nm">{r.nombre}</span>
            <span className="bar">
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="ct">{F.int(r.valor)}</span>
          </>
        );
        return r.onClick ? (
          <li key={r.nombre}>
            <button type="button" aria-pressed={!!r.activo} onClick={r.onClick}>
              {content}
            </button>
          </li>
        ) : (
          <li key={r.nombre}>
            <div className="row">{content}</div>
          </li>
        );
      })}
    </ul>
  );
}

function PorTier({ data }: { data: TierRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Repercusiones por tier</h2>
      <p>Tier 1 son medios masivos y Tier 3 regionales o de nicho.</p>
      <Bars rows={data.map((d) => ({ nombre: `Tier ${d.tier}`, valor: d.notas }))} max={max} />
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

function PorTipoMedio({
  data,
  filters,
  basePath,
  id,
  go,
}: {
  data: TipoMedioRow[];
  filters: PrensaFilters;
  basePath: string;
  id: Identity;
  go: (href: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Repercusiones por tipo de medio</h2>
      <p>Hacé clic en una barra para filtrar todo el tablero.</p>
      <Bars
        rows={data.map((d) => ({
          nombre: d.tipo_de_medio,
          valor: d.notas,
          activo: filters.tipoMedio === d.tipo_de_medio,
          onClick: () => go(toggleHref(basePath, filters, id, "tipoMedio", d.tipo_de_medio)),
        }))}
        max={max}
      />
    </div>
  );
}

function PorFormato({ data }: { data: FormatoRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Repercusiones por formato</h2>
      <Bars rows={data.map((d) => ({ nombre: d.formato, valor: d.notas }))} max={max} />
    </div>
  );
}

function TopLista({ titulo, nota, data }: { titulo: string; nota: string; data: RankedRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>{titulo}</h2>
      <p>{nota}</p>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.nombre, valor: d.notas }))} max={max} />
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
      <div className="pr-card wide">
        <h2>Días de mayor actividad</h2>
        <div className="pr-empty">Sin datos para este período.</div>
      </div>
    );
  }

  return (
    <div className="pr-card wide">
      <h2>Días de mayor actividad</h2>
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
      <div className="pr-hl">
        Menos <i /> Más
      </div>
    </div>
  );
}

function StatSplit({ rows }: { rows: { tipo: string; notas: number }[] }) {
  const total = rows.reduce((a, r) => a + r.notas, 0);
  if (!total) return <div className="pr-empty">Sin datos.</div>;
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {rows.map((r) => (
        <div key={r.tipo} className="stat">
          <span className="n" style={{ color: "var(--ink3)", fontSize: 12 }}>
            {r.tipo}
          </span>
          <span className="v">{F.pct((100 * r.notas) / total)}</span>
          <span className="pr-note">{F.int(r.notas)} notas</span>
        </div>
      ))}
    </div>
  );
}

function NacionalInterior({ data }: { data: NacionalInteriorRow[] }) {
  return (
    <div className="pr-card">
      <h2>Nacional e interior</h2>
      <StatSplit rows={data.map((d) => ({ tipo: d.tipo === "NACIONAL" ? "Nacional" : "Interior", notas: d.notas }))} />
    </div>
  );
}

function Provincias({ data }: { data: ProvinciaRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Provincias</h2>
      <p>Notas del interior, por provincia.</p>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.provincia, valor: d.notas }))} max={max} />
      </div>
    </div>
  );
}

function PorIndustria({ data }: { data: IndustriaRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card">
      <h2>Repercusiones por industria</h2>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.industria, valor: d.notas }))} max={max} />
      </div>
    </div>
  );
}

function PorCampana({ data }: { data: CampanaRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.notas));
  return (
    <div className="pr-card wide">
      <h2>Repercusiones por campaña</h2>
      <p>Lista completa con desplazamiento.</p>
      <div className="pr-rank scroll">
        <Bars rows={data.map((d) => ({ nombre: d.campana, valor: d.notas }))} max={max} />
      </div>
    </div>
  );
}

function GestionMencion({ data }: { data: GestionMencionRow[] }) {
  return (
    <div className="pr-card">
      <h2>Gestiones y menciones</h2>
      <p>Gestión es una nota que sale de una acción de prensa. Mención es una aparición colateral.</p>
      <StatSplit rows={data.map((d) => ({ tipo: d.tipo === "GESTIÓN" ? "Gestión" : "Mención", notas: d.notas }))} />
    </div>
  );
}

function OrganicaPaga({ data }: { data: OrganicaPagaRow[] }) {
  return (
    <div className="pr-card">
      <h2>Orgánica y paga</h2>
      <StatSplit rows={data.map((d) => ({ tipo: d.tipo === "ORGÁNICA" ? "Orgánica" : "Paga", notas: d.notas }))} />
    </div>
  );
}

function VapPorTipoMedio({ data }: { data: VapTipoMedioRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.vap));
  return (
    <div className="pr-card">
      <h2>VAP por tipo de medio</h2>
      <p>En millones de pesos.</p>
      <Bars rows={data.map((d) => ({ nombre: d.tipo_de_medio, valor: Math.round(d.vap / 1e6) }))} max={Math.max(1, max / 1e6)} />
    </div>
  );
}

function VapPorTier({ data }: { data: VapTierRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.vap));
  return (
    <div className="pr-card">
      <h2>VAP por tier</h2>
      <p>En millones de pesos.</p>
      <Bars rows={data.map((d) => ({ nombre: `Tier ${d.tier}`, valor: Math.round(d.vap / 1e6) }))} max={Math.max(1, max / 1e6)} />
    </div>
  );
}

function Detalle({ data }: { data: DetalleRow[] }) {
  const [soloConLink, setSoloConLink] = useState(false);
  const rows = soloConLink ? data.filter((r) => r.url) : data;
  return (
    <div className="pr-card wide">
      <div className="pr-head">
        <div>
          <h2>Detalle</h2>
          <p>{F.int(rows.length)} notas.</p>
        </div>
        <div className="pr-seg" role="group" aria-label="Enlaces">
          <button type="button" aria-pressed={!soloConLink} onClick={() => setSoloConLink(false)}>
            Con y sin enlace
          </button>
          <button type="button" aria-pressed={soloConLink} onClick={() => setSoloConLink(true)}>
            Solo con enlace
          </button>
        </div>
      </div>
      {!rows.length ? (
        <div className="pr-empty">Sin notas para este período.</div>
      ) : (
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{F.date(r.fecha)}</td>
                  <td className="pr-ttl">{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{F.text(r.tema)}</a> : F.text(r.tema)}</td>
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
      )}
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
