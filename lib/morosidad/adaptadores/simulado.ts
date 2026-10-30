import type { ItemDeuda, ProveedorId, ResultadoConsulta } from "../types";
import type { Adaptador } from "./tipos";

// Adaptador de prototipo: devuelve un resultado determinístico a partir del
// identificador, para poder diseñar el tablero antes de validar los portales
// reales. Se reemplaza proveedor por proveedor por el adaptador real.
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function dias(desde: Date, n: number): string {
  const d = new Date(desde);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function adaptadorSimulado(proveedor: ProveedorId, hoy = new Date()): Adaptador {
  return {
    proveedor,
    validarIdentificador: (id) => id.trim().length > 0,
    async consultar(identificador): Promise<ResultadoConsulta> {
      const consultadoEn = hoy.toISOString();
      const h = hash(`${proveedor}:${identificador}`);
      const caso = h % 10;
      if (caso === 0) return { ok: false, consultadoEn, motivo: "captcha", detalle: "El portal pidió captcha" };
      if (caso <= 4) return { ok: true, consultadoEn, items: [] };
      const cantidad = caso <= 6 ? 1 : 1 + (h % 3);
      const items: ItemDeuda[] = Array.from({ length: cantidad }, (_, i) => {
        const vencida = caso > 6 || i > 0;
        return {
          periodo: `2026-${String(10 - i).padStart(2, "0")}`,
          vencimiento: dias(hoy, vencida ? -15 - 30 * i : 9),
          importe: 8000 + ((h >>> (i + 3)) % 60000),
          boletaUrl: "#",
          codigoPagoElectronico: String(h).padStart(12, "0").slice(0, 12),
        };
      });
      return { ok: true, consultadoEn, items };
    },
  };
}
