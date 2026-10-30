// Modelo de dominio de /morosidad. La propiedad se identifica por su partida
// inmobiliaria (API Santa Fe): es del inmueble, no de una persona, así que no
// cambia con cada inquilino como sí cambian los números de cliente de gas,
// agua y luz. Cada cuenta de servicio cuelga de esa partida.

export type ProveedorId = "api_santafe" | "tgi_rosario" | "litoral_gas" | "assa" | "epe";

// "desconocido" existe a propósito y nunca se colapsa en "al_dia": si la
// consulta falló (portal caído, captcha, cambio de HTML), mostrar "sin deuda"
// sería un dato falso en el que la inmobiliaria confiaría.
export type EstadoDeuda = "al_dia" | "por_vencer" | "vencida" | "desconocido";

export type ItemDeuda = {
  periodo: string; // "2026-09" o "2026-5B" (bimestre), tal como lo informa el ente
  vencimiento: string; // ISO date
  importe: number; // ARS
  // Link a la boleta / segunda vía en el portal del ente. Nunca generamos
  // boletas propias: solo derivamos al canal oficial de pago.
  boletaUrl: string | null;
  codigoPagoElectronico: string | null;
};

export type ResultadoConsulta =
  | { ok: true; consultadoEn: string; items: ItemDeuda[] }
  | { ok: false; consultadoEn: string; motivo: "captcha" | "portal_caido" | "identificador_invalido" | "cambio_de_formato" | "error"; detalle?: string };

export type CuentaServicio = {
  id: string;
  proveedor: ProveedorId;
  identificador: string; // partida, cuenta TGI, nº de cliente, nº de suministro
  ultimaConsulta: ResultadoConsulta | null;
};

export type Propiedad = {
  id: string;
  inmobiliariaId: string;
  partida: string;
  direccion: string;
  ciudad: string;
  inquilino: string | null;
  finContrato: string | null; // ISO date: cuánto margen queda para cubrir con el depósito
  cuentas: CuentaServicio[];
};
