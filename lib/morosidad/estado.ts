import type { CuentaServicio, EstadoDeuda, ItemDeuda, Propiedad } from "./types";

const GRAVEDAD: Record<EstadoDeuda, number> = { al_dia: 0, por_vencer: 1, desconocido: 2, vencida: 3 };

export function estadoDeCuenta(cuenta: CuentaServicio, hoy = new Date()): EstadoDeuda {
  const r = cuenta.ultimaConsulta;
  if (!r || !r.ok) return "desconocido";
  if (r.items.length === 0) return "al_dia";
  return r.items.some((i) => new Date(i.vencimiento) < hoy) ? "vencida" : "por_vencer";
}

// El estado de la propiedad es el peor de sus cuentas. "desconocido" pesa más
// que "por_vencer": una propiedad con un servicio sin poder consultar no puede
// mostrarse como sana.
export function estadoDePropiedad(p: Propiedad, hoy = new Date()): EstadoDeuda {
  return p.cuentas
    .map((c) => estadoDeCuenta(c, hoy))
    .reduce<EstadoDeuda>((peor, e) => (GRAVEDAD[e] > GRAVEDAD[peor] ? e : peor), "al_dia");
}

export function itemsDe(cuenta: CuentaServicio): ItemDeuda[] {
  const r = cuenta.ultimaConsulta;
  return r && r.ok ? r.items : [];
}

export function montoVencido(p: Propiedad, hoy = new Date()): number {
  return p.cuentas
    .flatMap(itemsDe)
    .filter((i) => new Date(i.vencimiento) < hoy)
    .reduce((s, i) => s + i.importe, 0);
}

export const ESTADO_LABEL: Record<EstadoDeuda, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencida: "Vencida",
  desconocido: "Sin dato",
};

export function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
