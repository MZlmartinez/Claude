"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CampanaRow,
  ContratoRow,
  FiltroOpcion,
  FormatoRow,
  InfluencerFilters,
  InfluencerRow,
  InteraccionRow,
  Kpis,
  PiezaRow,
  TerritorioRow,
} from "@/lib/reports/influencers";
import { F, isNum } from "../influencers/format";
import "./inf.css";

// v2 — mismos datos y lógica que app/reportes/influencers/InfluencersDashboard.tsx
// (ver ese archivo para el precedente), pero con el CSS/layout portado 1:1 de
// la referencia nueva (ver inf.css) y el visor de material agregado a "Piezas
// destacadas". Vive en paralelo sin tocar la ruta vieja — recién si esto
// reemplaza a la actual, se borra /reportes/influencers.
const BASE_PATH = "/reportes/influencers-v2";
const FMT: Record<string, string> = { REEL: "Reel", STORIE: "Story", PRESENCIA: "Presencia", TIKTOK: "TikTok", TODOS: "Todos" };
const FCOL: Record<string, string> = { REEL: "var(--s1)", STORIE: "var(--s2)", PRESENCIA: "var(--s3)", TIKTOK: "var(--s4)" };
const FORMATO_ORDER = ["REEL", "STORIE", "PRESENCIA", "TIKTOK"];
const CAMP_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--acc)"];
const PAGES = [
  { id: "resumen", label: "Resumen" },
  { id: "influencers", label: "Influencers" },
  { id: "contenido", label: "Contenido" },
  { id: "campanas", label: "Campañas" },
  { id: "detalle", label: "Detalle" },
] as const;
type PageId = (typeof PAGES)[number]["id"];

// Material (clips) por pieza — ver lib/googleInfluencerMedia.ts. No hay
// forma confiable de atar un archivo a una pieza por formato/número, así
// que se resuelve por RANKING: la pieza con más visualizaciones de ese
// influencer en esa campaña = clip 1, la segunda = clip 2, etc. (confirmado
// con el equipo, es como están ordenados los archivos en Drive).
type Clip = { id: string; name: string };

function viewRank(piezas: PiezaRow[], piece: PiezaRow): number {
  const siblings = piezas
    .filter((p) => p.campana === piece.campana && p.influencer === piece.influencer)
    .sort((a, b) => (b.visualizaciones ?? 0) - (a.visualizaciones ?? 0) || a.id.localeCompare(b.id));
  return siblings.findIndex((p) => p.id === piece.id) + 1;
}

function mediaFileUrl(email: string, token: string, campana: string, influencer: string, fileId: string): string {
  const p = new URLSearchParams({ u: email, t: token, campana, influencer, fileId });
  return `/api/influencers/media/file?${p.toString()}`;
}

function qs(filters: InfluencerFilters): string {
  const p = new URLSearchParams();
  if (filters.campana) p.set("campana", filters.campana);
  if (filters.territorio) p.set("territorio", filters.territorio);
  if (filters.influencer) p.set("influencer", filters.influencer);
  if (filters.formato) p.set("formato", filters.formato);
  const s = p.toString();
  return s ? `${BASE_PATH}?${s}` : BASE_PATH;
}
function toggleHref(filters: InfluencerFilters, key: keyof InfluencerFilters, value: string) {
  return qs({ ...filters, [key]: filters[key] === value ? null : value });
}
function setHref(filters: InfluencerFilters, key: keyof InfluencerFilters, value: string | null) {
  return qs({ ...filters, [key]: value });
}
function scopeTxt(s: string | null) {
  if (!s) return "—";
  return s.replace(/REEL/g, "Reel").replace(/STORIE/g, "Story").replace(/PRESENCIA/g, "Presencia").replace(/TIKTOK/g, "TikTok");
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

type Props = {
  filters: InfluencerFilters;
  kpis: Kpis | null;
  campanas: CampanaRow[];
  formatos: FormatoRow[];
  influencers: InfluencerRow[];
  territorios: TerritorioRow[];
  interacciones: InteraccionRow[];
  piezas: PiezaRow[];
  contratos: ContratoRow[];
  opciones: FiltroOpcion[];
  fontClassName: string;
  // Solo la versión /secure los tiene (candado de identidad) — sin esto, la
  // galería de material no tiene cómo autenticar su propio fetch y
  // directamente no se ofrece (ver Destacadas más abajo).
  email?: string | null;
  token?: string | null;
};

export default function InfluencersDashboard({
  filters,
  kpis,
  campanas,
  formatos,
  influencers,
  territorios,
  interacciones,
  piezas,
  contratos,
  opciones,
  fontClassName,
  email,
  token,
}: Props) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [page, setPage] = useState<PageId>("resumen");
  const [campMetric, setCampMetric] = useState<"inversion" | "visualizaciones" | "interacciones">("inversion");
  const [lightbox, setLightbox] = useState<{ piece: PiezaRow; clip: Clip } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => router.push(href, { scroll: false });

  // Le avisa a la página que lo embebe (Softr) cuánto mide, para que el
  // iframe se ajuste al contenido real en vez de tener scroll propio.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined" || window.parent === window) return;

    const post = () => {
      window.parent.postMessage({ source: "coolmetrics-report", height: el.scrollHeight }, "*");
    };

    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, theme]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const onWheel = (e: WheelEvent) => {
      window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const campanaOpts = opciones.filter((o) => o.dimension === "campana").map((o) => o.valor);
  const territorioOpts = opciones.filter((o) => o.dimension === "territorio").map((o) => o.valor);
  const influencerOpts = opciones.filter((o) => o.dimension === "influencer").map((o) => o.valor);
  const formatosSinTotal = formatos.filter((f) => f.formato !== "TODOS");
  const hasFilters = !!(filters.campana || filters.territorio || filters.influencer || filters.formato);

  const campMetricInfo = {
    inversion: { title: "Inversión por campaña", fmt: F.moneyc, unit: "inversión total", note: "Presupuesto por contrato, contado una vez. Hacé clic en una barra para filtrar." },
    visualizaciones: { title: "Visualizaciones por campaña", fmt: F.compact, unit: "visualizaciones", note: "Suma de visualizaciones de las piezas. Hacé clic en una barra para filtrar." },
    interacciones: { title: "Interacciones por campaña", fmt: F.compact, unit: "interacciones", note: "Likes, comentarios, shares y guardados. Hacé clic en una barra para filtrar." },
  } as const;

  return (
    <div ref={rootRef} className={`inf ${fontClassName}`} data-theme={theme}>
      <div className="inf-wrap">
        <header>
          <div className="inf-top">
            <div>
              <div className="inf-kicker">MOSCÚ · Coolmetrics</div>
              <h1 className="inf-title">{kpis?.marca ?? "—"} · Influencers</h1>
              <nav className="inf-pages" role="tablist" aria-label="Secciones">
                {PAGES.map((p) => (
                  <button key={p.id} role="tab" aria-selected={page === p.id} onClick={() => setPage(p.id)}>
                    {p.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="inf-theme" role="group" aria-label="Tema">
              <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Oscura</button>
              <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Clara</button>
            </div>
          </div>
          <p className="inf-sub">
            {F.int(kpis?.contratos)} contratos entre el {F.date(kpis?.desde)} y el {F.date(kpis?.hasta)}
          </p>
        </header>

        <section className="inf-hero" aria-label="Resumen">
          <div className="inf-kpis">
            <Kpi label="Inversión" value={F.moneyc(kpis?.inversion)} sub={<>{F.int(kpis?.contratos)} contratos</>} />
            <Kpi label="Influencers" value={F.int(kpis?.influencers)} sub={<>{F.int(kpis?.territorios)} territorios</>} />
            <Kpi label="Piezas" value={F.int(kpis?.piezas)} sub={<>{F.int(kpis?.con_metricas)} con métricas</>} />
            <Kpi label="Visualizaciones" value={F.compact(kpis?.visualizaciones)} sub={<>alcance acumulado {F.compact(kpis?.alcance)}</>} />
            <Kpi label="Interacciones" value={F.compact(kpis?.interacciones)} sub={<>tasa {F.pct(kpis?.tasa_interaccion)} sobre vistas</>} />
            <Kpi label="Costo por mil vistas" value={F.money(kpis?.costo_mil_vistas)} sub="inversión sobre visualizaciones" />
          </div>
        </section>

        <div className="inf-ftabs" role="toolbar" aria-label="Formato">
          {formatos.map((r) => (
            <button
              key={r.formato}
              type="button"
              aria-pressed={(filters.formato ?? "TODOS") === r.formato}
              onClick={() => go(setHref(filters, "formato", r.formato === "TODOS" ? null : r.formato))}
            >
              {FMT[r.formato] ?? r.formato}
              <span>{F.int(r.piezas)}</span>
            </button>
          ))}
        </div>

        <div className="inf-filters">
          <label>
            Campaña
            <select value={filters.campana ?? ""} onChange={(e) => go(setHref(filters, "campana", e.target.value || null))}>
              <option value="">Todas las campañas</option>
              {campanaOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>
            Territorio
            <select value={filters.territorio ?? ""} onChange={(e) => go(setHref(filters, "territorio", e.target.value || null))}>
              <option value="">Todos los territorios</option>
              {territorioOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>
            Influencer
            <select value={filters.influencer ?? ""} onChange={(e) => go(setHref(filters, "influencer", e.target.value || null))}>
              <option value="">Todos los influencers</option>
              {influencerOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button className="inf-clear" type="button" onClick={() => go(BASE_PATH)}>
              Limpiar filtros
            </button>
          )}
        </div>

        {page === "resumen" && (
          <PageResumen
            filters={filters}
            campanas={campanas}
            formatos={formatos}
            influencers={influencers}
            territorios={territorios}
            interacciones={interacciones}
            piezas={piezas}
            campMetric={campMetric}
            setCampMetric={setCampMetric}
            campMetricInfo={campMetricInfo}
            go={go}
            onOpenMedia={(piece, clip) => setLightbox({ piece, clip })}
            email={email}
            token={token}
          />
        )}
        {page === "influencers" && <PageInfluencers filters={filters} influencers={influencers} go={go} email={email} token={token} />}
        {page === "contenido" && (
          <PageContenido filters={filters} formatosSinTotal={formatosSinTotal} formatos={formatos} piezas={piezas} go={go} />
        )}
        {page === "campanas" && <PageCampanas filters={filters} campanas={campanas} contratos={contratos} go={go} />}
        {page === "detalle" && <PageDetalle piezas={piezas} email={email} token={token} onOpenMedia={(piece, clip) => setLightbox({ piece, clip })} />}
      </div>

      <Lightbox lightbox={lightbox} email={email} token={token} onClose={() => setLightbox(null)} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="inf-kpi">
      <div className="inf-kpi-l">{label}</div>
      <div className="inf-kpi-v">{value}</div>
      <div className="inf-kpi-s">{sub}</div>
    </div>
  );
}

function Lightbox({
  lightbox,
  email,
  token,
  onClose,
}: {
  lightbox: { piece: PiezaRow; clip: Clip } | null;
  email?: string | null;
  token?: string | null;
  onClose: () => void;
}) {
  if (!lightbox || !email || !token) return null;
  const { piece, clip } = lightbox;
  const periodo =
    piece.periodo_desde && piece.periodo_hasta ? `${F.date(piece.periodo_desde)} al ${F.date(piece.periodo_hasta)}` : null;
  const stats: Array<{ label: string; value: string }> = [
    { label: "Vistas", value: F.int(piece.visualizaciones) },
    { label: "Alcance", value: F.int(piece.alcance) },
    { label: "Interacciones", value: F.int(piece.interacciones) },
    { label: "Tasa", value: F.pct(piece.tasa) },
    { label: "Likes", value: F.int(piece.likes) },
    { label: "Comentarios", value: F.int(piece.comentarios) },
    { label: "Shares", value: F.int(piece.shares) },
    { label: "Guardados", value: F.int(piece.guardados) },
    { label: "Clics a @", value: F.int(piece.clics) },
  ];
  return (
    <div className="inf-lb" role="presentation" onClick={onClose}>
      <div className="inf-lbp" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <video src={mediaFileUrl(email, token, piece.campana, piece.influencer, clip.id)} controls playsInline autoPlay />
        <div className="inf-lbc">
          <div>
            <b>{piece.influencer}</b>
            <div className="inf-sub2">
              Campaña {piece.campana} · {(FMT[piece.formato ?? ""] ?? piece.formato) + (piece.numero != null ? ` ${piece.numero}` : "")}
              {periodo && <> · {periodo}</>}
            </div>
          </div>
          <button className="inf-lbx" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="inf-lbs">
          {stats.map((s) => (
            <div key={s.label}>
              <span>{s.label}</span>
              <b>{s.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarList<T>({
  rows,
  labelOf,
  valueOf,
  fmt,
  colorOf,
  href,
  isSelected,
  keyOf,
  empty,
  go,
}: {
  rows: T[];
  labelOf: (r: T) => string;
  valueOf: (r: T) => number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  colorOf?: (r: T) => string;
  href?: (r: T) => string;
  isSelected?: (r: T) => boolean;
  keyOf: (r: T) => string;
  empty?: string;
  go: (href: string) => void;
}) {
  if (!rows.length) return <div className="inf-empty">{empty ?? "Sin datos para estos filtros."}</div>;
  const max = Math.max(1, ...rows.map((r) => valueOf(r) ?? 0));
  const anySelected = isSelected ? rows.some((r) => isSelected(r)) : false;
  return (
    <div className="inf-bl">
      {rows.map((r) => {
        const v = valueOf(r);
        const pct = max > 0 ? (Math.max(0, v ?? 0) / max) * 100 : 0;
        const sel = isSelected?.(r) ?? false;
        const cls = ["inf-bl-row", href ? "is-click" : "", sel ? "is-sel" : anySelected ? "is-dim" : ""].filter(Boolean).join(" ");
        return (
          <div key={keyOf(r)} className={cls} onClick={href ? () => go(href(r)) : undefined}>
            <div className="inf-bl-lab">{labelOf(r)}</div>
            <div className="inf-bl-track">
              <div className="inf-bl-fill" style={{ width: `${pct}%`, background: colorOf ? colorOf(r) : undefined }} />
            </div>
            <div className="inf-bl-val">{fmt(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ rows, filters, go }: { rows: FormatoRow[]; filters: InfluencerFilters; go: (href: string) => void }) {
  const total = rows.find((r) => r.formato === "TODOS");
  const data = rows.filter((r) => r.formato !== "TODOS" && r.piezas > 0);
  if (!data.length) return <div className="inf-empty">Sin piezas para estos filtros.</div>;
  const sum = data.reduce((a, r) => a + r.piezas, 0);
  const rOuter = 90, rInner = 58, cx = 100, cy = 100;
  const arcs = data.reduce<Array<FormatoRow & { start: number; end: number }>>((acc, r) => {
    const prevEnd = acc.length ? acc[acc.length - 1].end : -90;
    const sweep = (r.piezas / sum) * 360;
    acc.push({ ...r, start: prevEnd, end: prevEnd + sweep });
    return acc;
  }, []);
  const toXY = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const arcPath = (startDeg: number, endDeg: number) => {
    const pad = 1.2;
    const s = startDeg + pad / 2, e = endDeg - pad / 2;
    if (e <= s) return "";
    const [x1, y1] = toXY(s, rOuter), [x2, y2] = toXY(e, rOuter);
    const [x3, y3] = toXY(e, rInner), [x4, y4] = toXY(s, rInner);
    const largeArc = e - s > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };
  const sel = filters.formato;
  return (
    <div>
      <svg width="100%" viewBox="0 0 200 200" style={{ display: "block", maxWidth: 200, margin: "0 auto" }}>
        {arcs.map((a) => (
          <path
            key={a.formato}
            d={arcPath(a.start, a.end)}
            fill={FCOL[a.formato] ?? "var(--acc)"}
            opacity={!sel || sel === a.formato ? 1 : 0.35}
            style={{ cursor: "pointer" }}
            onClick={() => go(toggleHref(filters, "formato", a.formato))}
          >
            <title>{`${FMT[a.formato] ?? a.formato}: ${F.int(a.piezas)} piezas, ${F.compact(a.visualizaciones)} visualizaciones`}</title>
          </path>
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 26, fontFamily: "var(--mono)", fontWeight: 700 }}>
          {total ? F.int(total.piezas) : ""}
        </text>
        <text x={cx} y={cy + 26} textAnchor="middle" style={{ fill: "var(--ink3)", fontSize: 11 }}>
          piezas
        </text>
      </svg>
      <div className="inf-legend">
        {data.map((r) => (
          <span key={r.formato}>
            <i style={{ background: FCOL[r.formato] ?? "var(--acc)" }} />
            {FMT[r.formato] ?? r.formato}
            <b>{F.int(r.piezas)} · {Math.round((r.piezas / sum) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Piezas destacadas: miniatura 9:16 con el clip que le toca por ranking de
// visualizaciones (ver viewRank arriba) — placeholder punteado mientras
// carga o cuando esa pieza todavía no tiene clip subido.
function Destacadas({
  allPiezas,
  top,
  onOpenMedia,
  email,
  token,
}: {
  allPiezas: PiezaRow[];
  top: PiezaRow[];
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
  email?: string | null;
  token?: string | null;
}) {
  if (!top.length) return <div className="inf-empty">Ninguna pieza filtrada tiene visualizaciones.</div>;
  return (
    <div className="inf-feat">
      {top.map((r) => (
        <PieceCard
          key={r.id}
          piece={r}
          rank={viewRank(allPiezas, r)}
          onOpenMedia={onOpenMedia}
          email={email}
          token={token}
        />
      ))}
    </div>
  );
}

function PieceCard({
  piece,
  rank,
  onOpenMedia,
  email,
  token,
}: {
  piece: PiezaRow;
  rank: number;
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
  email?: string | null;
  token?: string | null;
}) {
  // undefined = cargando. Sin identidad (ruta vieja sin candado) arranca
  // directo en "sin material": no hay con qué autenticar el fetch, así que
  // nunca va a resolver nada distinto.
  const [clip, setClip] = useState<Clip | null | undefined>(() => (email && token ? undefined : null));

  useEffect(() => {
    if (!email || !token) return;
    let cancelled = false;
    // No hay alternativa idiomática a setState en un efecto para este fetch
    // interactivo (depende de props que cambian por navegación) — mismo
    // caso ya resuelto así en DocumentosDashboard.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClip(undefined);
    const p = new URLSearchParams({ u: email, t: token, campana: piece.campana, influencer: piece.influencer, rank: String(rank) });
    fetch(`/api/influencers/media?${p.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          console.error(`[influencers-v2] /api/influencers/media ${res.status} para ${piece.influencer} / ${piece.campana}:`, json);
          return { clip: null };
        }
        return json;
      })
      .then((json) => {
        if (!cancelled) setClip(json?.clip ?? null);
      })
      .catch((err) => {
        console.error(`[influencers-v2] fetch de media falló para ${piece.influencer} / ${piece.campana}:`, err);
        if (!cancelled) setClip(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, email, token, rank]);

  const ready = clip !== undefined && clip !== null;
  return (
    <div className={`inf-fi${ready ? " is-click" : ""}`} onClick={ready ? () => onOpenMedia(piece, clip) : undefined}>
      <div className={`inf-th${ready ? "" : " inf-th--ph"}`}>
        {ready && email && token ? (
          <>
            <video src={`${mediaFileUrl(email, token, piece.campana, piece.influencer, clip.id)}#t=0.5`} muted preload="metadata" />
            <span className="inf-play" aria-hidden="true" />
          </>
        ) : (
          <span>{clip === undefined ? "Cargando material…" : "Sin material cargado"}</span>
        )}
      </div>
      <div>
        <span className="inf-tag">{(FMT[piece.formato ?? ""] ?? piece.formato) + (piece.numero != null ? ` ${piece.numero}` : "")}</span>
        <span className="inf-fi-meta">{piece.campana}</span>
      </div>
      <div className="inf-fi-name">{piece.influencer}</div>
      <div className="inf-fi-big">{F.compact(piece.visualizaciones)}</div>
      <div className="inf-fi-sub">vistas · {F.compact(piece.interacciones)} interacciones · tasa {F.pct(piece.tasa)}</div>
    </div>
  );
}

// Columna "Contenido" de la tabla Influencers: cuántos clips reales hay
// cargados contra el total de piezas de ese influencer (sumando todas sus
// campañas) — ver getInfluencerMediaSummary. Solo cuenta, todavía no abre
// nada al hacer clic (eso depende de que el matching de Piezas destacadas
// esté confirmado funcionando).
function ContenidoCell({ influencer, email, token }: { influencer: string; email?: string | null; token?: string | null }) {
  const [summary, setSummary] = useState<{ totalPieces: number; availableClips: number } | null | undefined>(() =>
    email && token ? undefined : null,
  );

  useEffect(() => {
    if (!email || !token) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(undefined);
    const p = new URLSearchParams({ u: email, t: token, influencer });
    fetch(`/api/influencers/media/summary?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setSummary(json ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [influencer, email, token]);

  if (summary === undefined) return <span className="inf-fi-meta">Cargando…</span>;
  if (!summary || summary.availableClips === 0) return <span className="inf-fi-meta">—</span>;
  const shown = Math.min(3, summary.availableClips);
  return (
    <div className="inf-strip">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="inf-th inf-th--sm">
          <span className="inf-play" aria-hidden="true" />
        </span>
      ))}
      <span className="inf-fi-meta">
        {summary.availableClips} de {summary.totalPieces}
      </span>
    </div>
  );
}

function Scatter({ rows, filters, go }: { rows: InfluencerRow[]; filters: InfluencerFilters; go: (href: string) => void }) {
  const data = rows.filter((r) => r.inversion > 0 && r.visualizaciones > 0);
  if (!data.length) return <div className="inf-empty">Ningún influencer filtrado tiene presupuesto y vistas.</div>;
  const W = 560, H = 300, left = 56, right = 16, top = 12, bottom = 40;
  const maxY = Math.max(...data.map((r) => r.visualizaciones)) * 1.08;
  const maxX = Math.max(...data.map((r) => r.inversion)) * 1.08;
  const xScale = (v: number) => left + (v / maxX) * (W - left - right);
  const yScale = (v: number) => H - bottom - (v / maxY) * (H - bottom - top);
  const xt = ticks(maxX, 5), yt = ticks(maxY, 5);
  const sel = filters.influencer;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {yt.map((v) => <line key={`gy${v}`} x1={left} x2={W - right} y1={yScale(v)} y2={yScale(v)} stroke="var(--grid)" />)}
      {xt.map((v) => <line key={`gx${v}`} x1={xScale(v)} x2={xScale(v)} y1={top} y2={H - bottom} stroke="var(--grid)" />)}
      {yt.map((v) => (
        <text key={`ty${v}`} x={left - 6} y={yScale(v)} dy="0.35em" textAnchor="end" style={{ fill: "var(--ink3)", fontSize: 10 }}>
          {F.compact(v)}
        </text>
      ))}
      {xt.map((v) => (
        <text key={`tx${v}`} x={xScale(v)} y={H - 24} textAnchor="middle" style={{ fill: "var(--ink3)", fontSize: 10 }}>
          {F.moneyc(v)}
        </text>
      ))}
      <text x={(left + W - right) / 2} y={H - 6} textAnchor="middle" style={{ fill: "var(--ink2)", fontSize: 11 }}>Inversión</text>
      <text transform={`translate(11,${(H - 28) / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: "var(--ink2)", fontSize: 11 }}>
        Visualizaciones
      </text>
      {data.map((r) => (
        <circle
          key={r.influencer}
          cx={xScale(r.inversion)}
          cy={yScale(r.visualizaciones)}
          r={6}
          fill="var(--acc)"
          stroke="var(--card)"
          strokeWidth={1.5}
          opacity={!sel || sel === r.influencer ? 0.95 : 0.3}
          style={{ cursor: "pointer" }}
          onClick={() => go(toggleHref(filters, "influencer", r.influencer))}
        >
          <title>{`${r.influencer}\nInversión ${F.money(r.inversion)}\n${F.compact(r.visualizaciones)} visualizaciones\n${F.money(r.costo_mil_vistas)} por mil vistas`}</title>
        </circle>
      ))}
    </svg>
  );
}

function monthFloor(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function monthCeil(d: Date) { const f = monthFloor(d); return f.getTime() === d.getTime() ? f : new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 1)); }

function Gantt({ rows, filters, go }: { rows: ContratoRow[]; filters: InfluencerFilters; go: (href: string) => void }) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.desde && r.hasta)
        .map((r) => ({
          ...r,
          d0: new Date(`${r.desde}T00:00:00Z`),
          d1: new Date(new Date(`${r.hasta}T00:00:00Z`).getTime() + 86400000),
        }))
        .sort((a, b) => a.d0.getTime() - b.d0.getTime() || a.influencer.localeCompare(b.influencer, "es")),
    [rows],
  );
  if (!data.length) return <div className="inf-empty">Sin contratos para estos filtros.</div>;
  const t0 = monthFloor(data.reduce((m, r) => (r.d0 < m ? r.d0 : m), data[0].d0));
  const t1 = monthCeil(data.reduce((m, r) => (r.d1 > m ? r.d1 : m), data[0].d1));
  const span = t1.getTime() - t0.getTime();
  const pos = (d: Date) => ((d.getTime() - t0.getTime()) / span) * 100;
  const campColors = new Map<string, string>();
  data.forEach((r) => { if (!campColors.has(r.campana)) campColors.set(r.campana, CAMP_COLORS[campColors.size % CAMP_COLORS.length]); });
  const months: Date[] = [];
  for (let d = new Date(t0); d < t1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(new Date(d));
  const mf = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
  const today = new Date();
  const sel = filters.influencer;
  return (
    <div className="inf-gscroll">
      <div className="inf-legend" style={{ margin: "0 0 10px" }}>
        {Array.from(campColors.entries()).map(([name, c]) => (
          <span key={name}><i style={{ background: c }} />{name}</span>
        ))}
      </div>
      <div className="inf-gantt">
        <div className="inf-gantt-row">
          <div />
          <div className="inf-gantt-head">
            {months.map((m, i) => (
              <span key={i} style={{ left: `${pos(m)}%` }}>{mf.format(m).replace(".", "")}</span>
            ))}
          </div>
        </div>
        {data.map((r, i) => (
          <div key={i} className="inf-gantt-row" style={{ opacity: sel && sel !== r.influencer ? 0.45 : 1 }}>
            <button
              type="button"
              className="inf-gantt-name"
              title={`Filtrar por ${r.influencer}`}
              onClick={() => go(toggleHref(filters, "influencer", r.influencer))}
            >
              {r.influencer}
            </button>
            <div className="inf-gantt-track">
              {months.map((m, i2) => <div key={i2} className="inf-gantt-grid" style={{ left: `${pos(m)}%` }} />)}
              {today >= t0 && today <= t1 && <div className="inf-gantt-today" style={{ left: `${pos(today)}%` }} />}
              <div
                className="inf-gantt-bar"
                style={{ left: `${pos(r.d0)}%`, width: `${Math.max(0, pos(r.d1) - pos(r.d0))}%`, background: campColors.get(r.campana) }}
                title={`${r.campana} · ${F.date(r.desde)} → ${F.date(r.hasta)} · ${F.money(r.inversion)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stacks({ piezas, filters, go }: { piezas: PiezaRow[]; filters: InfluencerFilters; go: (href: string) => void }) {
  const rows = useMemo(() => {
    const byInf = new Map<string, Map<string, number>>();
    for (const p of piezas) {
      if (!p.formato) continue;
      if (!byInf.has(p.influencer)) byInf.set(p.influencer, new Map());
      const m = byInf.get(p.influencer)!;
      m.set(p.formato, (m.get(p.formato) ?? 0) + 1);
    }
    return Array.from(byInf.entries())
      .map(([influencer, m]) => {
        const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
        const byFormato = Array.from(m.entries())
          .map(([formato, count]) => ({ formato, count }))
          .sort((a, b) => FORMATO_ORDER.indexOf(a.formato) - FORMATO_ORDER.indexOf(b.formato));
        return { influencer, total, byFormato };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [piezas]);
  const [hover, setHover] = useState<string | null>(null);
  if (!rows.length) return <div className="inf-empty">Sin piezas para estos filtros.</div>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const xt = ticks(max, 6);
  const sel = filters.influencer;
  const hoverRow = rows.find((r) => r.influencer === hover);
  return (
    <div>
      <div className="inf-legend" style={{ marginBottom: 12 }}>
        {FORMATO_ORDER.map((f) => <span key={f}><i style={{ background: FCOL[f] }} />{FMT[f]}</span>)}
      </div>
      <div className="inf-stackchart">
        {rows.map((r) => {
          const cls = ["inf-stackchart-row", sel === r.influencer ? "is-sel" : sel ? "is-dim" : ""].filter(Boolean).join(" ");
          return (
            <div key={r.influencer} className={cls}>
              <button type="button" className="inf-stackchart-label" onClick={() => go(toggleHref(filters, "influencer", r.influencer))}>
                {r.influencer}
              </button>
              <div
                className="inf-stackchart-track"
                onMouseEnter={() => setHover(r.influencer)}
                onMouseLeave={() => setHover((h) => (h === r.influencer ? null : h))}
              >
                {xt.map((v) => <div key={v} className="inf-stackchart-grid" style={{ left: `${(v / max) * 100}%` }} />)}
                <div
                  className="inf-stack"
                  style={{ width: `${(r.total / max) * 100}%`, cursor: "pointer" }}
                  onClick={() => go(toggleHref(filters, "influencer", r.influencer))}
                >
                  {r.byFormato.map((seg) => (
                    <div key={seg.formato} style={{ width: `${(seg.count / r.total) * 100}%`, background: FCOL[seg.formato] ?? "var(--acc)" }} />
                  ))}
                </div>
                {hoverRow?.influencer === r.influencer && (
                  <div className="inf-tooltip" style={{ left: `${(r.total / max) * 100}%` }}>
                    <b>{r.influencer}</b>
                    {FORMATO_ORDER.map((f) => (
                      <div key={f}>
                        <i style={{ background: FCOL[f] }} />
                        {FMT[f]}: {r.byFormato.find((s) => s.formato === f)?.count ?? 0}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="inf-stackchart-row">
          <div className="inf-stackchart-label" />
          <div className="inf-stackchart-axis">
            {xt.map((v) => <span key={v} style={{ left: `${(v / max) * 100}%` }}>{F.int(v)}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- tablas genéricas ----------
type Column<T> = {
  key: string;
  label: string;
  num?: boolean;
  sec?: boolean;
  sortable?: boolean;
  sortValue?: (r: T) => number | string | null;
  render: (r: T, i: number) => React.ReactNode;
};

function TableShell<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  rowHref,
  isSelected,
  isTotal,
  go,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  initialSort?: { key: string; dir: 1 | -1 };
  rowHref?: (r: T) => string;
  isSelected?: (r: T) => boolean;
  isTotal?: (r: T) => boolean;
  go?: (href: string) => void;
}) {
  const [sort, setSort] = useState(initialSort ?? { key: "", dir: 1 as 1 | -1 });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a), y = col.sortValue!(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es")) * sort.dir;
    });
  }, [rows, sort, columns]);
  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    setSort((s) => (s.key === col.key ? { key: col.key, dir: (-s.dir) as 1 | -1 } : { key: col.key, dir: -1 }));
  };
  return (
    <div className="inf-tablewrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={[c.num ? "num" : "", c.sec ? "inf-sec" : ""].filter(Boolean).join(" ")}
                aria-sort={sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}
              >
                {c.sortable ? <button onClick={() => toggleSort(c)}>{c.label}</button> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td className="inf-empty" colSpan={columns.length}>Sin datos para estos filtros.</td></tr>
          ) : (
            sorted.map((r, i) => {
              const cls = [rowHref ? "is-click" : "", isSelected?.(r) ? "is-sel" : "", isTotal?.(r) ? "is-total" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={rowKey(r)} className={cls || undefined} onClick={rowHref ? () => go?.(rowHref(r)) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={[c.num ? "num" : "", c.sec ? "inf-sec" : ""].filter(Boolean).join(" ")}>
                      {c.render(r, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- página Resumen ----------
function PageResumen({
  filters,
  campanas,
  formatos,
  influencers,
  territorios,
  interacciones,
  piezas,
  campMetric,
  setCampMetric,
  campMetricInfo,
  go,
  onOpenMedia,
  email,
  token,
}: {
  filters: InfluencerFilters;
  campanas: CampanaRow[];
  formatos: FormatoRow[];
  influencers: InfluencerRow[];
  territorios: TerritorioRow[];
  interacciones: InteraccionRow[];
  piezas: PiezaRow[];
  campMetric: "inversion" | "visualizaciones" | "interacciones";
  setCampMetric: (m: "inversion" | "visualizaciones" | "interacciones") => void;
  campMetricInfo: Record<"inversion" | "visualizaciones" | "interacciones", { title: string; fmt: (v: number | null | undefined) => string; unit: string; note: string }>;
  go: (href: string) => void;
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
  email?: string | null;
  token?: string | null;
}) {
  const campanasSorted = campanas.slice().sort((a, b) => (b[campMetric] ?? 0) - (a[campMetric] ?? 0));
  const destacadas = piezas.filter((r) => (r.visualizaciones ?? 0) > 0).sort((a, b) => (b.visualizaciones ?? 0) - (a.visualizaciones ?? 0)).slice(0, 4);
  const topVistas = influencers.filter((r) => r.visualizaciones > 0).sort((a, b) => b.visualizaciones - a.visualizaciones).slice(0, 5);
  const topCosto = influencers.filter((r) => isNum(r.costo_mil_vistas)).sort((a, b) => (a.costo_mil_vistas ?? 0) - (b.costo_mil_vistas ?? 0)).slice(0, 5);
  return (
    <section className="inf-page">
      <div className="inf-grid">
        <div className="inf-card">
          <div className="inf-card-head">
            <h2>{campMetricInfo[campMetric].title}</h2>
            <div className="inf-seg" role="group" aria-label="Métrica">
              {(["inversion", "visualizaciones", "interacciones"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={campMetric === m} onClick={() => setCampMetric(m)}>
                  {m === "inversion" ? "Inversión" : m === "visualizaciones" ? "Vistas" : "Interacc."}
                </button>
              ))}
            </div>
          </div>
          <p className="inf-note">{campMetricInfo[campMetric].note}</p>
          <div className="inf-box" style={{ minHeight: 240 }}>
            <BarList
              rows={campanasSorted}
              labelOf={(r) => r.campana}
              valueOf={(r) => r[campMetric]}
              fmt={campMetricInfo[campMetric].fmt}
              keyOf={(r) => r.campana}
              href={(r) => toggleHref(filters, "campana", r.campana)}
              isSelected={(r) => filters.campana === r.campana}
              go={go}
            />
          </div>
        </div>
        <div className="inf-card">
          <h2>Mix de contenido</h2>
          <p className="inf-note">Piezas recibidas por formato.</p>
          <div className="inf-box" style={{ minHeight: 240 }}>
            <Donut rows={formatos} filters={filters} go={go} />
          </div>
        </div>
      </div>

      <div className="inf-card">
        <h2>Piezas destacadas</h2>
        <p className="inf-note">Las cuatro con más visualizaciones dentro de los filtros.</p>
        <Destacadas allPiezas={piezas} top={destacadas} onOpenMedia={onOpenMedia} email={email} token={token} />
      </div>

      <div className="inf-grid">
        <div className="inf-card">
          <h2>Visualizaciones por territorio</h2>
          <p className="inf-note">Suma de visualizaciones de las piezas. Hacé clic para filtrar.</p>
          <div className="inf-box">
            <BarList
              rows={territorios}
              labelOf={(r) => r.territorio}
              valueOf={(r) => r.visualizaciones}
              fmt={F.compact}
              keyOf={(r) => r.territorio}
              href={(r) => toggleHref(filters, "territorio", r.territorio)}
              isSelected={(r) => filters.territorio === r.territorio}
              go={go}
            />
          </div>
        </div>
        <div className="inf-card">
          <h2>Interacciones por tipo</h2>
          <p className="inf-note">Suma de todas las piezas filtradas.</p>
          <div className="inf-box">
            <BarList rows={interacciones} labelOf={(r) => r.tipo} valueOf={(r) => r.valor} fmt={F.compact} keyOf={(r) => r.tipo} go={go} />
          </div>
        </div>
      </div>

      <div className="inf-grid">
        <div className="inf-card">
          <h2>Influencers con más visualizaciones</h2>
          <p className="inf-note">Los cinco primeros. Hacé clic para filtrar.</p>
          <div className="inf-box" style={{ minHeight: 150 }}>
            <BarList
              rows={topVistas}
              labelOf={(r) => r.influencer}
              valueOf={(r) => r.visualizaciones}
              fmt={F.compact}
              keyOf={(r) => r.influencer}
              href={(r) => toggleHref(filters, "influencer", r.influencer)}
              isSelected={(r) => filters.influencer === r.influencer}
              go={go}
            />
          </div>
        </div>
        <div className="inf-card">
          <h2>Menor costo por mil vistas</h2>
          <p className="inf-note">Solo contratos con presupuesto cargado.</p>
          <div className="inf-box" style={{ minHeight: 150 }}>
            <BarList
              rows={topCosto}
              labelOf={(r) => r.influencer}
              valueOf={(r) => r.costo_mil_vistas}
              fmt={F.money}
              keyOf={(r) => r.influencer}
              href={(r) => toggleHref(filters, "influencer", r.influencer)}
              isSelected={(r) => filters.influencer === r.influencer}
              colorOf={() => "var(--acc)"}
              empty="Ningún contrato filtrado tiene presupuesto y vistas."
              go={go}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- página Influencers ----------
function PageInfluencers({
  filters,
  influencers,
  go,
  email,
  token,
}: {
  filters: InfluencerFilters;
  influencers: InfluencerRow[];
  go: (href: string) => void;
  email?: string | null;
  token?: string | null;
}) {
  const costo12 = influencers.filter((r) => isNum(r.costo_mil_vistas)).sort((a, b) => (a.costo_mil_vistas ?? 0) - (b.costo_mil_vistas ?? 0)).slice(0, 12);
  const top5 = influencers
    .filter((r) => isNum(r.ranking_promedio))
    .sort((a, b) => (a.ranking_promedio ?? 0) - (b.ranking_promedio ?? 0) || (a.costo_por_interaccion ?? 0) - (b.costo_por_interaccion ?? 0))
    .slice(0, 5);

  const topColumns: Column<InfluencerRow>[] = [
    { key: "rank", label: "#", num: true, render: (_r, i) => String(i + 1) },
    { key: "influencer", label: "Influencer", render: (r) => r.influencer },
    { key: "inversion", label: "Inversión", num: true, render: (r) => F.money(r.inversion) },
    { key: "piezas", label: "Piezas", num: true, sec: true, render: (r) => F.int(r.piezas) },
    { key: "costo_por_interaccion", label: "$ / interacción", num: true, render: (r) => F.money(r.costo_por_interaccion) },
    { key: "tasa", label: "Tasa", num: true, render: (r) => F.pct(r.tasa) },
    { key: "costo_mil_vistas", label: "$ / mil vistas", num: true, sec: true, render: (r) => F.money(r.costo_mil_vistas) },
    { key: "ranking_promedio", label: "Puesto prom.", num: true, render: (r) => (isNum(r.ranking_promedio) ? r.ranking_promedio.toFixed(1) : "—") },
  ];
  const infColumns: Column<InfluencerRow>[] = [
    { key: "influencer", label: "Influencer", sortable: true, sortValue: (r) => r.influencer, render: (r) => r.influencer },
    { key: "contenido", label: "Contenido", render: (r) => <ContenidoCell influencer={r.influencer} email={email} token={token} /> },
    { key: "territorio", label: "Territorio", sec: true, sortable: true, sortValue: (r) => r.territorio, render: (r) => r.territorio ?? "—" },
    { key: "seguidores_ig", label: "Seguidores IG", num: true, sortable: true, sortValue: (r) => r.seguidores_ig, render: (r) => F.int(r.seguidores_ig) },
    { key: "seguidores_tiktok", label: "Seguidores TikTok", num: true, sec: true, sortable: true, sortValue: (r) => r.seguidores_tiktok, render: (r) => F.int(r.seguidores_tiktok) },
    { key: "er_ig", label: "ER IG", num: true, sortable: true, sortValue: (r) => r.er_ig, render: (r) => F.pct(r.er_ig) },
    { key: "campanas", label: "Campañas", sec: true, sortable: true, sortValue: (r) => r.campanas, render: (r) => r.campanas ?? "—" },
    { key: "inversion", label: "Inversión", num: true, sortable: true, sortValue: (r) => r.inversion, render: (r) => (r.inversion === 0 ? "Sin fee" : F.money(r.inversion)) },
    { key: "piezas", label: "Piezas", num: true, sec: true, sortable: true, sortValue: (r) => r.piezas, render: (r) => F.int(r.piezas) },
    { key: "visualizaciones", label: "Visualiz.", num: true, sortable: true, sortValue: (r) => r.visualizaciones, render: (r) => F.int(r.visualizaciones) },
    { key: "interacciones", label: "Interacc.", num: true, sec: true, sortable: true, sortValue: (r) => r.interacciones, render: (r) => F.int(r.interacciones) },
    { key: "tasa", label: "Tasa", num: true, sortable: true, sortValue: (r) => r.tasa, render: (r) => F.pct(r.tasa) },
    { key: "costo_mil_vistas", label: "$ / mil vistas", num: true, sortable: true, sortValue: (r) => r.costo_mil_vistas, render: (r) => F.money(r.costo_mil_vistas) },
    { key: "costo_por_interaccion", label: "$ / interacc.", num: true, sec: true, sortable: true, sortValue: (r) => r.costo_por_interaccion, render: (r) => F.money(r.costo_por_interaccion) },
  ];

  return (
    <section className="inf-page">
      <div className="inf-grid">
        <div className="inf-card">
          <h2>Inversión y visualizaciones</h2>
          <p className="inf-note">Cada punto es un influencer con presupuesto. Más arriba y más a la izquierda rinde mejor.</p>
          <div className="inf-box" style={{ minHeight: 300 }}>
            <Scatter rows={influencers} filters={filters} go={go} />
          </div>
        </div>
        <div className="inf-card">
          <h2>Costo por mil vistas</h2>
          <p className="inf-note">Los 12 más eficientes, en pesos.</p>
          <div className="inf-box" style={{ minHeight: 300 }}>
            <BarList
              rows={costo12}
              labelOf={(r) => r.influencer}
              valueOf={(r) => r.costo_mil_vistas}
              fmt={F.money}
              keyOf={(r) => r.influencer}
              href={(r) => toggleHref(filters, "influencer", r.influencer)}
              isSelected={(r) => filters.influencer === r.influencer}
              colorOf={() => "var(--acc)"}
              empty="Ningún contrato filtrado tiene presupuesto y vistas."
              go={go}
            />
          </div>
        </div>
      </div>

      <div className="inf-card">
        <h2>Mejor rendimiento</h2>
        <p className="inf-note">
          Promedio del puesto de cada influencer en costo por interacción, tasa de interacción y costo por mil vistas. Solo
          influencers con presupuesto, vistas e interacciones.
        </p>
        {top5.length >= 2 && (
          <p className="inf-lead">
            <b>{top5[0].influencer}</b> y <b>{top5[1].influencer}</b> encabezan el ranking, con <b>{F.money(top5[0].costo_por_interaccion)}</b> y{" "}
            <b>{F.money(top5[1].costo_por_interaccion)}</b> por interacción. El resultado más confiable es el de{" "}
            <b>{(top5[0].piezas >= top5[1].piezas ? top5[0] : top5[1]).influencer}</b>, que lo sostiene con{" "}
            <b>{F.int((top5[0].piezas >= top5[1].piezas ? top5[0] : top5[1]).piezas)}</b> piezas.
          </p>
        )}
        <TableShell columns={topColumns} rows={top5} rowKey={(r) => r.influencer} />
        <p className="inf-note">
          Con 2 a 12 piezas por influencer, una sola pieza viral puede mover el ranking: mirá la columna de piezas antes de decidir.
        </p>
      </div>

      <div className="inf-card">
        <h2>Influencers</h2>
        <p className="inf-note">Hacé clic en una fila para filtrar y en un encabezado para ordenar.</p>
        <TableShell
          columns={infColumns}
          rows={influencers}
          rowKey={(r) => r.influencer}
          initialSort={{ key: "inversion", dir: -1 }}
          rowHref={(r) => toggleHref(filters, "influencer", r.influencer)}
          isSelected={(r) => filters.influencer === r.influencer}
          go={go}
        />
      </div>
    </section>
  );
}

// ---------- página Contenido ----------
function PageContenido({
  filters,
  formatosSinTotal,
  formatos,
  piezas,
  go,
}: {
  filters: InfluencerFilters;
  formatosSinTotal: FormatoRow[];
  formatos: FormatoRow[];
  piezas: PiezaRow[];
  go: (href: string) => void;
}) {
  const fmtColumns: Column<FormatoRow>[] = [
    { key: "formato", label: "Formato", render: (r) => (r.formato === "TODOS" ? "Total" : FMT[r.formato] ?? r.formato) },
    { key: "piezas", label: "Piezas", num: true, render: (r) => F.int(r.piezas) },
    { key: "con_metricas", label: "Con vistas", num: true, sec: true, render: (r) => F.int(r.con_metricas) },
    { key: "visualizaciones", label: "Visualiz.", num: true, render: (r) => F.int(r.visualizaciones) },
    { key: "alcance", label: "Alcance", num: true, sec: true, render: (r) => F.int(r.alcance) },
    { key: "interacciones", label: "Interacc.", num: true, render: (r) => F.int(r.interacciones) },
    { key: "tasa", label: "Tasa", num: true, render: (r) => F.pct(r.tasa) },
    { key: "guardados", label: "Guardados", num: true, sec: true, render: (r) => F.int(r.guardados) },
    { key: "shares", label: "Shares", num: true, sec: true, render: (r) => F.int(r.shares) },
    { key: "clics", label: "Clics a @", num: true, sec: true, render: (r) => F.int(r.clics) },
  ];
  const fmtRows = [...formatosSinTotal, ...formatos.filter((r) => r.formato === "TODOS")];

  return (
    <section className="inf-page">
      <div className="inf-grid">
        <div className="inf-card">
          <h2>Visualizaciones por pieza</h2>
          <p className="inf-note">Promedio de las piezas con visualizaciones. Presencia no tiene.</p>
          <div className="inf-box" style={{ minHeight: 140 }}>
            <BarList
              rows={formatosSinTotal}
              labelOf={(r) => FMT[r.formato] ?? r.formato}
              valueOf={(r) => r.vis_promedio}
              fmt={F.compact}
              keyOf={(r) => r.formato}
              href={(r) => toggleHref(filters, "formato", r.formato)}
              isSelected={(r) => filters.formato === r.formato}
              colorOf={(r) => FCOL[r.formato] ?? "var(--acc)"}
              go={go}
            />
          </div>
        </div>
        <div className="inf-card">
          <h2>Tasa de interacción</h2>
          <p className="inf-note">Interacciones sobre visualizaciones.</p>
          <div className="inf-box" style={{ minHeight: 140 }}>
            <BarList
              rows={formatosSinTotal}
              labelOf={(r) => FMT[r.formato] ?? r.formato}
              valueOf={(r) => r.tasa}
              fmt={F.pct}
              keyOf={(r) => r.formato}
              href={(r) => toggleHref(filters, "formato", r.formato)}
              isSelected={(r) => filters.formato === r.formato}
              colorOf={(r) => FCOL[r.formato] ?? "var(--acc)"}
              go={go}
            />
          </div>
        </div>
      </div>

      <div className="inf-card">
        <h2>Piezas por influencer y formato</h2>
        <p className="inf-note">Los 12 con más piezas.</p>
        <div className="inf-box" style={{ minHeight: 300 }}>
          <Stacks piezas={piezas} filters={filters} go={go} />
        </div>
      </div>

      <div className="inf-card">
        <h2>Rendimiento por formato</h2>
        <p className="inf-note">Hacé clic en una fila para filtrar por formato.</p>
        <TableShell
          columns={fmtColumns}
          rows={fmtRows}
          rowKey={(r) => r.formato}
          rowHref={(r) => (r.formato === "TODOS" ? setHref(filters, "formato", null) : toggleHref(filters, "formato", r.formato))}
          isSelected={(r) => filters.formato === r.formato}
          isTotal={(r) => r.formato === "TODOS"}
          go={go}
        />
      </div>
    </section>
  );
}

// ---------- página Campañas ----------
function PageCampanas({
  filters,
  campanas,
  contratos,
  go,
}: {
  filters: InfluencerFilters;
  campanas: CampanaRow[];
  contratos: ContratoRow[];
  go: (href: string) => void;
}) {
  const campColumns: Column<CampanaRow>[] = [
    { key: "campana", label: "Campaña", render: (r) => r.campana },
    { key: "contratos", label: "Contratos", num: true, render: (r) => F.int(r.contratos) },
    { key: "inversion", label: "Inversión", num: true, render: (r) => F.money(r.inversion) },
    { key: "piezas", label: "Piezas", num: true, sec: true, render: (r) => F.int(r.piezas) },
    { key: "visualizaciones", label: "Visualiz.", num: true, render: (r) => F.int(r.visualizaciones) },
    { key: "interacciones", label: "Interacc.", num: true, sec: true, render: (r) => F.int(r.interacciones) },
    { key: "costo_mil_vistas", label: "$ / mil vistas", num: true, render: (r) => F.money(r.costo_mil_vistas) },
  ];
  const scopeRows = contratos
    .slice()
    .sort(
      (a, b) =>
        (a.cumplimiento ?? 999) - (b.cumplimiento ?? 999) ||
        a.campana.localeCompare(b.campana, "es") ||
        a.influencer.localeCompare(b.influencer, "es"),
    );
  const scopeColumns: Column<ContratoRow>[] = [
    {
      key: "contrato",
      label: "Contrato",
      render: (r) => (
        <>
          {r.influencer}
          <span className="inf-sub2">{r.campana}</span>
        </>
      ),
    },
    { key: "acordado", label: "Acordado", render: (r) => scopeTxt(r.acordado) },
    { key: "recibido", label: "Recibido", render: (r) => scopeTxt(r.recibido) },
    { key: "sin_metricas", label: "Sin vistas", num: true, sec: true, render: (r) => F.int(r.sin_metricas) },
    {
      key: "cumplimiento",
      label: "Cumplimiento",
      num: true,
      render: (r) => {
        const v = r.cumplimiento;
        const cls = !isNum(v) ? "none" : v >= 100 ? "ok" : "warn";
        return <span className={`inf-badge ${cls}`}>{isNum(v) ? `${Math.round(v)} %` : "Sin scope cargado"}</span>;
      },
    },
  ];

  return (
    <section className="inf-page">
      <div className="inf-card">
        <h2>Calendario de contratos</h2>
        <p className="inf-note">Período de cada contrato. Hacé clic en un nombre para filtrar.</p>
        <div className="inf-box" style={{ minHeight: 320 }}>
          <Gantt rows={contratos} filters={filters} go={go} />
        </div>
      </div>

      <div className="inf-card">
        <h2>Campañas</h2>
        <p className="inf-note">Hacé clic en una fila para filtrar.</p>
        <TableShell
          columns={campColumns}
          rows={campanas}
          rowKey={(r) => r.campana}
          rowHref={(r) => toggleHref(filters, "campana", r.campana)}
          isSelected={(r) => filters.campana === r.campana}
          go={go}
        />
      </div>

      <div className="inf-card">
        <h2>Cumplimiento del scope</h2>
        <p className="inf-note">
          Piezas recibidas contra las acordadas, formato por formato. Lo que excede lo acordado no suma más de 100 %.
        </p>
        <TableShell
          columns={scopeColumns}
          rows={scopeRows}
          rowKey={(r) => `${r.campana}__${r.influencer}`}
          rowHref={(r) => toggleHref(filters, "influencer", r.influencer)}
          isSelected={(r) => filters.influencer === r.influencer}
          go={go}
        />
      </div>
    </section>
  );
}

// ---------- página Detalle ----------
// Clip (si existe) para una pieza puntual, por ranking de visualizaciones
// dentro de su influencer+campaña — mismo mecanismo que PieceCard en
// Piezas destacadas, reusado acá para las columnas Material/Video de
// Detalle. undefined = cargando, null = sin identidad o sin clip.
function useClipForPiece(piece: PiezaRow, allPiezas: PiezaRow[], email?: string | null, token?: string | null): Clip | null | undefined {
  const [clip, setClip] = useState<Clip | null | undefined>(() => (email && token ? undefined : null));

  useEffect(() => {
    if (!email || !token) return;
    let cancelled = false;
    const rank = viewRank(allPiezas, piece);
    const p = new URLSearchParams({ u: email, t: token, campana: piece.campana, influencer: piece.influencer, rank: String(rank) });
    fetch(`/api/influencers/media?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : { clip: null }))
      .then((json) => {
        if (!cancelled) setClip(json?.clip ?? null);
      })
      .catch(() => {
        if (!cancelled) setClip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [piece, allPiezas, email, token]);

  return clip;
}

function MaterialCell({
  piece,
  allPiezas,
  email,
  token,
  onOpenMedia,
}: {
  piece: PiezaRow;
  allPiezas: PiezaRow[];
  email?: string | null;
  token?: string | null;
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
}) {
  const clip = useClipForPiece(piece, allPiezas, email, token);
  if (clip === undefined) {
    return (
      <div className="inf-th inf-th--cell inf-th--ph">
        <span>…</span>
      </div>
    );
  }
  if (!clip) {
    return (
      <div className="inf-th inf-th--cell inf-th--ph">
        <span>—</span>
      </div>
    );
  }
  return (
    <div className="inf-th inf-th--cell is-click" onClick={() => onOpenMedia(piece, clip)}>
      {email && token && <video src={`${mediaFileUrl(email, token, piece.campana, piece.influencer, clip.id)}#t=0.5`} muted preload="metadata" />}
      <span className="inf-play" aria-hidden="true" />
    </div>
  );
}

function VideoCell({
  piece,
  allPiezas,
  email,
  token,
  onOpenMedia,
}: {
  piece: PiezaRow;
  allPiezas: PiezaRow[];
  email?: string | null;
  token?: string | null;
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
}) {
  const clip = useClipForPiece(piece, allPiezas, email, token);
  if (!clip) return <span className="inf-fi-meta">—</span>;
  return (
    <button type="button" className="inf-vbtn" onClick={() => onOpenMedia(piece, clip)}>
      ▶ Ver video
    </button>
  );
}

function PageDetalle({
  piezas,
  email,
  token,
  onOpenMedia,
}: {
  piezas: PiezaRow[];
  email?: string | null;
  token?: string | null;
  onOpenMedia: (piece: PiezaRow, clip: Clip) => void;
}) {
  const [q, setQ] = useState("");
  const [metric, setMetric] = useState<"" | "con" | "sin">("");
  const [shown, setShown] = useState(50);
  const filtered = piezas.filter((r) => {
    const qok = !q || `${r.influencer} ${r.campana}`.toLowerCase().includes(q.trim().toLowerCase());
    const mok = !metric || (metric === "con" ? (r.visualizaciones ?? 0) > 0 : !((r.visualizaciones ?? 0) > 0));
    return qok && mok;
  });
  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;
  const columns: Column<PiezaRow>[] = [
    { key: "material", label: "Material", render: (r) => <MaterialCell piece={r} allPiezas={piezas} email={email} token={token} onOpenMedia={onOpenMedia} /> },
    {
      key: "influencer",
      label: "Influencer",
      sortable: true,
      sortValue: (r) => r.influencer,
      render: (r) => (
        <>
          {r.influencer}
          <span className="inf-sub2">{r.campana}</span>
        </>
      ),
    },
    {
      key: "formato",
      label: "Formato",
      sortable: true,
      sortValue: (r) => r.formato,
      render: (r) => (FMT[r.formato ?? ""] ?? r.formato) + (r.numero != null ? ` ${r.numero}` : ""),
    },
    { key: "visualizaciones", label: "Visualiz.", num: true, sortable: true, sortValue: (r) => r.visualizaciones, render: (r) => F.int(r.visualizaciones) },
    { key: "alcance", label: "Alcance", num: true, sec: true, sortable: true, sortValue: (r) => r.alcance, render: (r) => F.int(r.alcance) },
    { key: "likes", label: "Likes", num: true, sec: true, sortable: true, sortValue: (r) => r.likes, render: (r) => F.int(r.likes) },
    { key: "comentarios", label: "Coment.", num: true, sec: true, sortable: true, sortValue: (r) => r.comentarios, render: (r) => F.int(r.comentarios) },
    { key: "shares", label: "Shares", num: true, sec: true, sortable: true, sortValue: (r) => r.shares, render: (r) => F.int(r.shares) },
    { key: "guardados", label: "Guardados", num: true, sec: true, sortable: true, sortValue: (r) => r.guardados, render: (r) => F.int(r.guardados) },
    { key: "clics", label: "Clics a @", num: true, sec: true, sortable: true, sortValue: (r) => r.clics, render: (r) => F.int(r.clics) },
    { key: "tasa", label: "Tasa", num: true, sortable: true, sortValue: (r) => r.tasa, render: (r) => F.pct(r.tasa) },
    {
      key: "video",
      label: "Video",
      render: (r) => <VideoCell piece={r} allPiezas={piezas} email={email} token={token} onOpenMedia={onOpenMedia} />,
    },
  ];
  return (
    <section className="inf-page">
      <div className="inf-card">
        <div className="inf-tools">
          <input
            type="search"
            placeholder="Buscar por influencer o campaña"
            aria-label="Buscar"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(50);
            }}
          />
          <select
            aria-label="Métricas"
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as "" | "con" | "sin");
              setShown(50);
            }}
          >
            <option value="">Con y sin vistas</option>
            <option value="con">Con vistas</option>
            <option value="sin">Sin vistas</option>
          </select>
        </div>
        <div className="inf-count">Mostrando {F.int(visible.length)} de {F.int(filtered.length)} piezas</div>
        <TableShell columns={columns} rows={visible} rowKey={(r) => r.id} initialSort={{ key: "visualizaciones", dir: -1 }} />
        {remaining > 0 && (
          <button type="button" className="inf-more" onClick={() => setShown((s) => s + 50)}>
            Mostrar 50 más ({remaining} restantes)
          </button>
        )}
      </div>
    </section>
  );
}
