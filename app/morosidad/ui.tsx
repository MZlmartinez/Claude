import Link from "next/link";
import type { EstadoDeuda } from "@/lib/morosidad/types";
import { ESTADO_LABEL } from "@/lib/morosidad/estado";

const ESTADO_CLASES: Record<EstadoDeuda, string> = {
  al_dia: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  por_vencer: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  vencida: "border-red-400/40 bg-red-500/15 text-red-300",
  desconocido: "border-white/15 bg-white/5 text-white/50",
};

export function EstadoChip({ estado, label }: { estado: EstadoDeuda; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${ESTADO_CLASES[estado]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? ESTADO_LABEL[estado]}
    </span>
  );
}

export function MorosidadHeader({ actual }: { actual: "tablero" | "importar" }) {
  const tab = (href: string, label: string, activo: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${activo ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-white/60 hover:text-white"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <p className="font-heading text-xs tracking-[0.2em] text-[var(--accent)]">MOROSIDAD · ROSARIO</p>
          <p className="text-sm text-white/50">Inmobiliaria demo · datos simulados</p>
        </div>
        <nav className="flex gap-1">
          {tab("/morosidad", "Tablero", actual === "tablero")}
          {tab("/morosidad/importar", "Cargar propiedades", actual === "importar")}
        </nav>
      </div>
    </header>
  );
}
