import type { CuentaServicio, ResultadoConsulta } from "./types";
import type { Adaptador } from "./adaptadores/tipos";

// Ejecuta la consulta de una cuenta con reintentos. En producción esto corre
// en un worker que toma cuentas "vencidas de consulta" de una cola, con límite
// de concurrencia por proveedor (para no disparar bloqueos) y guarda cada
// resultado como snapshot en morosidad.consultas — nunca pisa el anterior.
export async function consultarCuenta(
  cuenta: CuentaServicio,
  adaptador: Adaptador,
  { reintentos = 2 }: { reintentos?: number } = {},
): Promise<ResultadoConsulta> {
  if (!adaptador.validarIdentificador(cuenta.identificador)) {
    return { ok: false, consultadoEn: new Date().toISOString(), motivo: "identificador_invalido" };
  }
  let ultimo: ResultadoConsulta | null = null;
  for (let intento = 0; intento <= reintentos; intento++) {
    ultimo = await adaptador.consultar(cuenta.identificador);
    // captcha e identificador inválido no se arreglan reintentando.
    if (ultimo.ok || ultimo.motivo === "captcha" || ultimo.motivo === "identificador_invalido") break;
  }
  return ultimo!;
}
