import type { ProveedorId } from "./types";

// Catálogo de entes. Sumar una ciudad = sumar entradas acá + su adaptador.
// TODO(validación manual): para cada ente, confirmar si alcanza el
// identificador o pide login, si hay captcha, si muestra importe adeudado y si
// la boleta es descargable. Eso define `requiereNavegador` y la frecuencia.
export const PROVEEDORES: Record<
  ProveedorId,
  {
    nombre: string;
    corto: string;
    ambito: "provincial" | "municipal" | "distribuidora";
    identificadorLabel: string;
    // Facturación mensual/bimestral: consultar a diario no aporta y aumenta el
    // riesgo de bloqueo. Se consulta cada N días y además unos días después
    // de cada vencimiento (los pagos tardan 2–5 días hábiles en acreditarse).
    frecuenciaDias: number;
    requiereNavegador: boolean | null; // null = todavía no validado
  }
> = {
  api_santafe: {
    nombre: "API Santa Fe — Impuesto Inmobiliario",
    corto: "Inmobiliario",
    ambito: "provincial",
    identificadorLabel: "Partida inmobiliaria",
    frecuenciaDias: 7,
    requiereNavegador: null,
  },
  tgi_rosario: {
    nombre: "Municipalidad de Rosario — TGI",
    corto: "TGI",
    ambito: "municipal",
    identificadorLabel: "Cuenta TGI",
    frecuenciaDias: 7,
    requiereNavegador: null,
  },
  litoral_gas: {
    nombre: "Litoral Gas",
    corto: "Gas",
    ambito: "distribuidora",
    identificadorLabel: "Nº de cliente",
    frecuenciaDias: 7,
    requiereNavegador: null,
  },
  assa: {
    nombre: "Aguas Santafesinas (ASSA)",
    corto: "Agua",
    ambito: "distribuidora",
    identificadorLabel: "Nº de cuenta",
    frecuenciaDias: 7,
    requiereNavegador: null,
  },
  epe: {
    nombre: "EPE — Energía de Santa Fe",
    corto: "Luz",
    ambito: "distribuidora",
    identificadorLabel: "Nº de suministro",
    frecuenciaDias: 7,
    requiereNavegador: null,
  },
};

export const ORDEN_PROVEEDORES: ProveedorId[] = ["api_santafe", "tgi_rosario", "litoral_gas", "assa", "epe"];
