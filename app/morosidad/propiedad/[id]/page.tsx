import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarCarteraDemo } from "@/lib/morosidad/datosDemo";
import { estadoDeCuenta, estadoDePropiedad, formatARS, itemsDe, montoVencido } from "@/lib/morosidad/estado";
import { PROVEEDORES } from "@/lib/morosidad/proveedores";
import { EstadoChip, MorosidadHeader } from "../../ui";

export const dynamic = "force-dynamic";

const MOTIVO_LABEL = {
  captcha: "El portal pidió captcha",
  portal_caido: "El portal no respondió",
  identificador_invalido: "Identificador inválido — revisar carga",
  cambio_de_formato: "El portal cambió su formato",
  error: "Error inesperado",
} as const;

export default async function PropiedadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hoy = new Date();
  const p = (await cargarCarteraDemo(hoy)).find((x) => x.id === id);
  if (!p) notFound();

  const vencido = montoVencido(p, hoy);
  const estado = estadoDePropiedad(p, hoy);

  return (
    <div className="flex flex-1 flex-col">
      <MorosidadHeader actual="tablero" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Link href="/morosidad" className="text-sm text-white/50 hover:text-white">← Volver al tablero</Link>

        <section className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
          <div>
            <h1 className="font-heading text-3xl text-white">{p.direccion}</h1>
            <p className="mt-1 text-sm text-white/50">
              {p.ciudad} · Partida {p.partida}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {p.inquilino ? `Inquilino: ${p.inquilino}` : "Desocupada"}
              {p.finContrato && ` · Fin de contrato: ${new Date(p.finContrato).toLocaleDateString("es-AR")}`}
            </p>
          </div>
          <div className="text-right">
            <EstadoChip estado={estado} />
            <p className={`mt-2 font-heading text-3xl ${vencido > 0 ? "text-red-300" : "text-white"}`}>
              {vencido > 0 ? formatARS(vencido) : "Sin deuda vencida"}
            </p>
            {p.cuentas.some((c) => estadoDeCuenta(c, hoy) === "desconocido") && (
              <p className="mt-1 text-xs text-white/40">Hay servicios sin dato: el total puede estar incompleto.</p>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {p.cuentas.map((c) => {
            const prov = PROVEEDORES[c.proveedor];
            const estado = estadoDeCuenta(c, hoy);
            const r = c.ultimaConsulta;
            const items = itemsDe(c);
            return (
              <article key={c.id} className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-white">{prov.nombre}</h2>
                    <p className="text-xs text-white/40">
                      {prov.identificadorLabel}: {c.identificador}
                    </p>
                  </div>
                  <EstadoChip estado={estado} />
                </header>

                {r && !r.ok && (
                  <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                    {MOTIVO_LABEL[r.motivo]}. Consultar manualmente en el portal del ente.
                  </p>
                )}
                {r && r.ok && items.length === 0 && <p className="mt-4 text-sm text-white/50">No registra boletas impagas.</p>}
                {items.length > 0 && (
                  <ul className="mt-4 divide-y divide-white/5">
                    {items.map((i) => {
                      const vencida = new Date(i.vencimiento) < hoy;
                      return (
                        <li key={i.periodo} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <div>
                            <p className="text-white">Período {i.periodo}</p>
                            <p className={`text-xs ${vencida ? "text-red-300" : "text-white/40"}`}>
                              {vencida ? "Venció" : "Vence"} el {new Date(i.vencimiento).toLocaleDateString("es-AR")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="tabular-nums text-white">{formatARS(i.importe)}</span>
                            {i.boletaUrl && (
                              <a
                                href={i.boletaUrl}
                                className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-foreground)]"
                              >
                                Ver boleta
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {r && (
                  <p className="mt-3 text-xs text-white/30">
                    Última consulta: {new Date(r.consultadoEn).toLocaleString("es-AR")}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
