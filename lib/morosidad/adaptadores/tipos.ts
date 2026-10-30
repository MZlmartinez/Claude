import type { ProveedorId, ResultadoConsulta } from "../types";

// Contrato común de todos los entes. Cada adaptador real (scraper HTTP o
// Playwright) implementa esto; el resto del sistema no sabe cómo se obtuvo el
// dato. Un adaptador nunca lanza: los fallos vuelven como { ok: false } para
// que la cuenta quede en "desconocido" y no en "al día".
export interface Adaptador {
  proveedor: ProveedorId;
  validarIdentificador(identificador: string): boolean;
  consultar(identificador: string): Promise<ResultadoConsulta>;
}
