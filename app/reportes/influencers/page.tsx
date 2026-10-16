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

// Figuras grandes (stat tiles): compactas, 1,284 / 12.9K / $4.2M.
function compact(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const value = Number(n);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString("es-AR");
}

// Columnas de tabla: siempre precisas, tabular-nums las alinea.
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

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const widthPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-28 shrink-0 truncate text-sm text-[var(--text-secondary)]">{label}</div>
      <div className="relative h-6 flex-1">
        <div className="absolute inset-y-[9px] w-full rounded-full bg-[var(--track)]" />
        <div
          className="absolute inset-y-[9px] rounded-full bg-[var(--series-1)]"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="w-16 shrink-0 text-right text-sm font-medium text-[var(--text-primary)]">
        {compact(value)}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm">
      <div className="text-[13px] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`sticky top-0 whitespace-nowrap bg-[var(--surface)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)] ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      className={`whitespace-nowrap border-t border-[var(--gridline)] px-3 py-2 text-[13px] tabular-nums text-[var(--text-primary)] ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function Select({ name, defaultValue, options, placeholder }: {
  name: string;
  defaultValue: string;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
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
      className="min-h-screen bg-[var(--page)] px-4 py-8 sm:px-8"
      style={
        {
          "--page": "#f9f9f7",
          "--surface": "#fcfcfb",
          "--text-primary": "#0b0b0b",
          "--text-secondary": "#52514e",
          "--text-muted": "#898781",
          "--gridline": "#e1e0d9",
          "--track": "#e1e0d9",
          "--border": "rgba(11,11,11,0.10)",
          "--series-1": "#2a78d6",
          "--series-2": "#eb6834",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Influencers{kpis?.marca ? ` · ${kpis.marca}` : ""}
            </h1>
            {kpis?.desde && kpis?.hasta && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {kpis.desde} — {kpis.hasta}
              </p>
            )}
          </div>

          <form className="flex flex-wrap items-center gap-2" method="get">
            <Select name="campana" defaultValue={filters.campana ?? ""} options={campanaOpts} placeholder="Toda campaña" />
            <Select name="territorio" defaultValue={filters.territorio ?? ""} options={territorioOpts} placeholder="Todo territorio" />
            <Select name="influencer" defaultValue={filters.influencer ?? ""} options={influencerOpts} placeholder="Todo influencer" />
            <Select name="formato" defaultValue={filters.formato ?? ""} options={FORMATOS_CONOCIDOS} placeholder="Todo formato" />
            <button type="submit" className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-sm font-medium text-white">
              Filtrar
            </button>
            {(filters.campana || filters.territorio || filters.influencer || filters.formato) && (
              <a href="/reportes/influencers" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)]">
                Limpiar
              </a>
            )}
          </form>
        </div>

        {kpis && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Contratos" value={compact(kpis.contratos)} />
            <StatTile label="Influencers" value={compact(kpis.influencers)} />
            <StatTile label="Piezas" value={compact(kpis.piezas)} />
            <StatTile label="Inversión" value={`$${compact(kpis.inversion)}`} />
            <StatTile label="Visualizaciones" value={compact(kpis.visualizaciones)} />
            <StatTile label="Interacciones" value={compact(kpis.interacciones)} />
            <StatTile label="Tasa de interacción" value={pct(kpis.tasa_interaccion)} />
            <StatTile label="Costo por mil vistas" value={`$${compact(kpis.costo_mil_vistas)}`} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Rendimiento por formato">
            {formatosSinTotal.map((f) => (
              <Bar key={f.formato} label={f.formato} value={f.visualizaciones} max={maxVisFormato} />
            ))}
          </Card>

          <Card title="Interacciones por tipo">
            {interacciones.map((i) => (
              <Bar key={i.tipo} label={i.tipo} value={i.valor} max={maxInteraccion} />
            ))}
          </Card>
        </div>

        <Card title="Inversión por campaña">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-collapse">
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
                  <tr key={c.campana} className="hover:bg-[var(--page)]">
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
          </div>
        </Card>

        <Card title="Resultados por influencer">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-collapse">
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
                  <tr key={inf.influencer} className="hover:bg-[var(--page)]">
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
          </div>
        </Card>

        <Card title="Vistas por territorio">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-collapse">
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
                  <tr key={t.territorio} className="hover:bg-[var(--page)]">
                    <Td>{t.territorio}</Td>
                    <Td align="right">{num(t.piezas)}</Td>
                    <Td align="right">{num(t.influencers)}</Td>
                    <Td align="right">{num(t.visualizaciones)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Contratos y scope">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-collapse">
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
                  <tr key={`${c.campana}-${c.influencer}-${i}`} className="hover:bg-[var(--page)]">
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
          </div>
        </Card>

        <Card title="Detalle de piezas">
          <div className="-mx-5 max-h-[480px] overflow-y-auto overflow-x-auto px-5">
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
                  <tr key={p.id} className="hover:bg-[var(--page)]">
                    <Td>{p.influencer}</Td>
                    <Td>{p.campana}</Td>
                    <Td>{p.formato ?? "—"}</Td>
                    <Td align="right">{num(p.visualizaciones)}</Td>
                    <Td align="right">{num(p.alcance)}</Td>
                    <Td align="right">{num(p.interacciones)}</Td>
                    <Td align="right">{pct(p.tasa)}</Td>
                    <Td>
                      {p.clipping ? (
                        <a href={p.clipping} target="_blank" rel="noreferrer" className="font-medium text-[var(--series-1)]">
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
        </Card>

        <p className="py-6 text-center text-xs text-[var(--text-muted)]">
          Datos de Supabase (gold_influencers) — Moscu Coolmetrics
        </p>
      </div>
    </main>
  );
}
