import Link from "next/link";
import { cargarCarteraDemo } from "@/lib/morosidad/datosDemo";
import { ESTADO_LABEL, estadoDeCuenta, estadoDePropiedad, formatARS, montoVencido } from "@/lib/morosidad/estado";
import { ORDEN_PROVEEDORES, PROVEEDORES } from "@/lib/morosidad/proveedores";
import type { EstadoDeuda } from "@/lib/morosidad/types";
import { EstadoChip, MorosidadHeader } from "./ui";

export const dynamic = "force-dynamic";

const FILTROS: (EstadoDeuda | "todas")[] = ["todas", "vencida", "desconocido", "por_vencer", "al_dia"];

export default async function MorosidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtro = (Array.isArray(sp.estado) ? sp.estado[0] : sp.estado) ?? "todas";
  const hoy = new Date();
  const cartera = await cargarCarteraDemo(hoy);

  const filas = cartera
    .map((p) => ({ p, estado: estadoDePropiedad(p, hoy), vencido: montoVencido(p, hoy) }))
    .sort((a, b) => b.vencido - a.vencido);
  const visibles = filtro === "todas" ? filas : filas.filter((f) => f.estado === filtro);

  const conVencida = filas.filter((f) => f.estado === "vencida").length;
  const totalVencido = filas.reduce((s, f) => s + f.vencido, 0);
  const sinDato = cartera.flatMap((p) => p.cuentas).filter((c) => estadoDeCuenta(c, hoy) === "desconocido").length;

  return (
    <div className="flex flex-1 flex-col">
      <MorosidadHeader actual="tablero" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Propiedades" valor={String(cartera.length)} />
          <Kpi titulo="Con deuda vencida" valor={String(conVencida)} destacado={conVencida > 0} />
          <Kpi titulo="Monto vencido total" valor={formatARS(totalVencido)} destacado={totalVencido > 0} />
          <Kpi titulo="Consultas sin dato" valor={String(sinDato)} nota="Revisar a mano: captcha o portal caído" />
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f}
              href={f === "todas" ? "/morosidad" : `/morosidad?estado=${f}`}
              className={`rounded-full border px-3 py-1 text-sm ${filtro === f ? "border-[var(--accent)] text-[var(--accent)]" : "border-white/10 text-white/60 hover:text-white"}`}
            >
              {f === "todas" ? "Todas" : ESTADO_LABEL[f]}
            </Link>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-white/5 text-left text-xs tracking-wide text-white/50 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Propiedad</th>
                {ORDEN_PROVEEDORES.map((id) => (
                  <th key={id} className="px-3 py-3 font-medium">{PROVEEDORES[id].corto}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Vencido</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ p, vencido }) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/morosidad/propiedad/${p.id}`} className="font-medium text-white hover:text-[var(--accent)]">
                      {p.direccion}
                    </Link>
                    <p className="text-xs text-white/40">
                      {p.partida} · {p.inquilino ?? "Desocupada"}
                    </p>
                  </td>
                  {ORDEN_PROVEEDORES.map((id) => {
                    const cuenta = p.cuentas.find((c) => c.proveedor === id);
                    return (
                      <td key={id} className="px-3 py-3">
                        {cuenta ? <EstadoChip estado={estadoDeCuenta(cuenta, hoy)} /> : <span className="text-white/20">—</span>}
                      </td>
                    );
                  })}
                  <td className={`px-4 py-3 text-right tabular-nums ${vencido > 0 ? "text-red-300" : "text-white/40"}`}>
                    {vencido > 0 ? formatARS(vencido) : "—"}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={ORDEN_PROVEEDORES.length + 2} className="px-4 py-10 text-center text-white/40">
                    No hay propiedades en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/40">
          “Sin dato” significa que la consulta falló — nunca se muestra como “Al día”.
        </p>
      </main>
    </div>
  );
}

function Kpi({ titulo, valor, destacado, nota }: { titulo: string; valor: string; destacado?: boolean; nota?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
      <p className="text-xs tracking-wide text-white/50 uppercase">{titulo}</p>
      <p className={`mt-2 font-heading text-3xl ${destacado ? "text-red-300" : "text-white"}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-white/40">{nota}</p>}
    </div>
  );
}
