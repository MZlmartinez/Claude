import {
  getCampanas,
  getContratos,
  getFormatos,
  getInfluencers,
  getInteracciones,
  getKpis,
  getOpciones,
  getPiezas,
  getTerritorios,
  type InfluencerFilters,
} from "@/lib/reports/influencers";

export const dynamic = "force-dynamic";

const FORMATOS_CONOCIDOS = ["REEL", "STORIE", "PRESENCIA", "TIKTOK"];

function num(n: number | string | null | undefined, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function money(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function pct(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

function Bar({ label, value, max, colorVar }: { label: string; value: number; max: number; colorVar: string }) {
  const widthPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 text-sm text-[var(--text-secondary)]">{label}</div>
      <div className="relative h-5 flex-1 rounded bg-[var(--gridline)]">
        <div
          className="h-5 rounded"
          style={{ width: `${widthPct}%`, backgroundColor: `var(${colorVar})` }}
        />
      </div>
      <div className="w-24 shrink-0 text-right text-sm tabular-nums text-[var(--text-primary)]">
        {num(value)}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`sticky top-0 bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`border-t border-[var(--gridline)] px-3 py-2 text-sm tabular-nums ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

export default async function InfluencersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

  const filters: InfluencerFilters = {
    campana: one(params.campana),
    territorio: one(params.territorio),
    influencer: one(params.influencer),
    formato: one(params.formato),
  };

  const [kpis, campanas, formatos, influencers, territorios, interacciones, piezas, contratos, opciones] =
    await Promise.all([
      getKpis(filters),
      getCampanas(filters),
      getFormatos(filters),
      getInfluencers(filters),
      getTerritorios(filters),
      getInteracciones(filters),
      getPiezas(filters),
      getContratos(filters),
      getOpciones(),
    ]);

  const campanaOpts = opciones.filter((o) => o.dimension === "campana").map((o) => o.valor);
  const territorioOpts = opciones.filter((o) => o.dimension === "territorio").map((o) => o.valor);
  const influencerOpts = opciones.filter((o) => o.dimension === "influencer").map((o) => o.valor);

  const formatosSinTotal = formatos.filter((f) => f.formato !== "TODOS");
  const maxVisFormato = Math.max(1, ...formatosSinTotal.map((f) => f.visualizaciones));
  const maxInteraccion = Math.max(1, ...interacciones.map((i) => i.valor));

  return (
    <main
      className="mx-auto max-w-6xl px-4 py-8"
      style={
        {
          "--surface": "#fcfcfb",
          "--text-primary": "#0b0b0b",
          "--text-secondary": "#52514e",
          "--gridline": "#e1e0d9",
          "--border": "rgba(11,11,11,0.10)",
          "--series-1": "#2a78d6",
          "--series-2": "#eb6834",
        } as React.CSSProperties
      }
    >
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">
        Reporte de influencers{kpis?.marca ? ` — ${kpis.marca}` : ""}
      </h1>
      {kpis?.desde && kpis?.hasta && (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Período: {kpis.desde} a {kpis.hasta}
        </p>
      )}

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <select name="campana" defaultValue={filters.campana ?? ""} className="rounded border border-[var(--border)] px-2 py-1.5 text-sm">
          <option value="">Toda campaña</option>
          {campanaOpts.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="territorio" defaultValue={filters.territorio ?? ""} className="rounded border border-[var(--border)] px-2 py-1.5 text-sm">
          <option value="">Todo territorio</option>
          {territorioOpts.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select name="influencer" defaultValue={filters.influencer ?? ""} className="rounded border border-[var(--border)] px-2 py-1.5 text-sm">
          <option value="">Todo influencer</option>
          {influencerOpts.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select name="formato" defaultValue={filters.formato ?? ""} className="rounded border border-[var(--border)] px-2 py-1.5 text-sm">
          <option value="">Todo formato</option>
          {FORMATOS_CONOCIDOS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button type="submit" className="rounded bg-[var(--text-primary)] px-3 py-1.5 text-sm text-white">
          Filtrar
        </button>
        <a href="/reportes/influencers" className="rounded border border-[var(--border)] px-3 py-1.5 text-sm">
          Limpiar
        </a>
      </form>

      {kpis && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Contratos" value={num(kpis.contratos)} />
          <StatTile label="Influencers" value={num(kpis.influencers)} />
          <StatTile label="Piezas" value={num(kpis.piezas)} />
          <StatTile label="Inversión" value={money(kpis.inversion)} />
          <StatTile label="Visualizaciones" value={num(kpis.visualizaciones)} />
          <StatTile label="Interacciones" value={num(kpis.interacciones)} />
          <StatTile label="Tasa de interacción" value={pct(kpis.tasa_interaccion)} />
          <StatTile label="Costo por mil vistas" value={money(kpis.costo_mil_vistas)} />
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Rendimiento por formato</h2>
        <div className="mt-3">
          {formatosSinTotal.map((f) => (
            <Bar key={f.formato} label={f.formato} value={f.visualizaciones} max={maxVisFormato} colorVar="--series-1" />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Interacciones por tipo</h2>
        <div className="mt-3">
          {interacciones.map((i) => (
            <Bar key={i.tipo} label={i.tipo} value={i.valor} max={maxInteraccion} colorVar="--series-2" />
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-x-auto">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Inversión por campaña</h2>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <Th>Campaña</Th>
              <Th align="right">Contratos</Th>
              <Th align="right">Inversión</Th>
              <Th align="right">Piezas</Th>
              <Th align="right">Visualizaciones</Th>
              <Th align="right">Interacciones</Th>
              <Th align="right">Costo / mil vistas</Th>
            </tr>
          </thead>
          <tbody>
            {campanas.map((c) => (
              <tr key={c.campana}>
                <Td>{c.campana}</Td>
                <Td align="right">{num(c.contratos)}</Td>
                <Td align="right">{money(c.inversion)}</Td>
                <Td align="right">{num(c.piezas)}</Td>
                <Td align="right">{num(c.visualizaciones)}</Td>
                <Td align="right">{num(c.interacciones)}</Td>
                <Td align="right">{money(c.costo_mil_vistas)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 overflow-x-auto">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Resultados por influencer</h2>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <Th>Influencer</Th>
              <Th>Territorio</Th>
              <Th align="right">Contratos</Th>
              <Th align="right">Inversión</Th>
              <Th align="right">Piezas</Th>
              <Th align="right">Visualizaciones</Th>
              <Th align="right">Interacciones</Th>
              <Th align="right">Tasa</Th>
              <Th align="right">Costo / mil vistas</Th>
              <Th align="right">Ranking</Th>
            </tr>
          </thead>
          <tbody>
            {influencers.map((inf) => (
              <tr key={inf.influencer}>
                <Td>{inf.influencer}</Td>
                <Td>{inf.territorio ?? "—"}</Td>
                <Td align="right">{num(inf.contratos)}</Td>
                <Td align="right">{money(inf.inversion)}</Td>
                <Td align="right">{num(inf.piezas)}</Td>
                <Td align="right">{num(inf.visualizaciones)}</Td>
                <Td align="right">{num(inf.interacciones)}</Td>
                <Td align="right">{pct(inf.tasa)}</Td>
                <Td align="right">{money(inf.costo_mil_vistas)}</Td>
                <Td align="right">{inf.ranking_promedio ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 overflow-x-auto">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Vistas por territorio</h2>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <Th>Territorio</Th>
              <Th align="right">Piezas</Th>
              <Th align="right">Influencers</Th>
              <Th align="right">Visualizaciones</Th>
            </tr>
          </thead>
          <tbody>
            {territorios.map((t) => (
              <tr key={t.territorio}>
                <Td>{t.territorio}</Td>
                <Td align="right">{num(t.piezas)}</Td>
                <Td align="right">{num(t.influencers)}</Td>
                <Td align="right">{num(t.visualizaciones)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 overflow-x-auto">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Contratos y scope</h2>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <Th>Campaña</Th>
              <Th>Influencer</Th>
              <Th>Desde</Th>
              <Th>Hasta</Th>
              <Th align="right">Inversión</Th>
              <Th align="right">Piezas</Th>
              <Th>Acordado</Th>
              <Th>Recibido</Th>
              <Th align="right">Cumplimiento</Th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c, i) => (
              <tr key={`${c.campana}-${c.influencer}-${i}`}>
                <Td>{c.campana}</Td>
                <Td>{c.influencer}</Td>
                <Td>{c.desde ?? "—"}</Td>
                <Td>{c.hasta ?? "—"}</Td>
                <Td align="right">{money(c.inversion)}</Td>
                <Td align="right">{num(c.piezas)}</Td>
                <Td>{c.acordado ?? "—"}</Td>
                <Td>{c.recibido ?? "—"}</Td>
                <Td align="right">{c.cumplimiento !== null ? pct(c.cumplimiento) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 overflow-x-auto pb-10">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Detalle de piezas</h2>
        <div className="mt-3 max-h-[480px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Influencer</Th>
                <Th>Campaña</Th>
                <Th>Formato</Th>
                <Th align="right">Visualizaciones</Th>
                <Th align="right">Alcance</Th>
                <Th align="right">Interacciones</Th>
                <Th align="right">Tasa</Th>
                <Th>Clipping</Th>
              </tr>
            </thead>
            <tbody>
              {piezas.map((p) => (
                <tr key={p.id}>
                  <Td>{p.influencer}</Td>
                  <Td>{p.campana}</Td>
                  <Td>{p.formato ?? "—"}</Td>
                  <Td align="right">{num(p.visualizaciones)}</Td>
                  <Td align="right">{num(p.alcance)}</Td>
                  <Td align="right">{num(p.interacciones)}</Td>
                  <Td align="right">{pct(p.tasa)}</Td>
                  <Td>
                    {p.clipping ? (
                      <a href={p.clipping} target="_blank" rel="noreferrer" className="text-[var(--series-1)] underline">
                        ver
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
