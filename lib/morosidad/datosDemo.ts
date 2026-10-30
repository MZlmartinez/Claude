import { adaptadorSimulado } from "./adaptadores/simulado";
import { consultarCuenta } from "./consultar";
import { ORDEN_PROVEEDORES, PROVEEDORES } from "./proveedores";
import type { Propiedad } from "./types";

// Cartera de ejemplo de una inmobiliaria. Direcciones, partidas y cuentas son
// ficticias. Cuando esté la base, esto se reemplaza por una lectura de
// morosidad.propiedades + la última fila de morosidad.consultas por cuenta.
const CARTERA: Omit<Propiedad, "cuentas">[] = [
  { id: "p1", inmobiliariaId: "demo", partida: "16-03-00-741203/0001-4", direccion: "Córdoba 1452, 3º B", ciudad: "Rosario", inquilino: "M. Gómez", finContrato: "2027-03-31" },
  { id: "p2", inmobiliariaId: "demo", partida: "16-03-00-741877/0002-1", direccion: "Bv. Oroño 980, PB", ciudad: "Rosario", inquilino: "L. Fernández", finContrato: "2026-12-15" },
  { id: "p3", inmobiliariaId: "demo", partida: "16-03-00-739912/0000-8", direccion: "Mendoza 3210", ciudad: "Rosario", inquilino: "S. Ruiz", finContrato: "2028-01-31" },
  { id: "p4", inmobiliariaId: "demo", partida: "16-03-00-740455/0005-3", direccion: "Pellegrini 1120, 8º A", ciudad: "Rosario", inquilino: "J. Pereyra", finContrato: "2026-11-30" },
  { id: "p5", inmobiliariaId: "demo", partida: "16-03-00-742301/0000-6", direccion: "San Juan 2560", ciudad: "Rosario", inquilino: null, finContrato: null },
  { id: "p6", inmobiliariaId: "demo", partida: "16-03-00-738640/0003-2", direccion: "Italia 845, 5º C", ciudad: "Rosario", inquilino: "A. Medina", finContrato: "2027-07-31" },
  { id: "p7", inmobiliariaId: "demo", partida: "16-03-00-743118/0000-9", direccion: "Alem 1675", ciudad: "Rosario", inquilino: "C. Sosa", finContrato: "2027-01-31" },
  { id: "p8", inmobiliariaId: "demo", partida: "16-03-00-741990/0004-5", direccion: "Rioja 2030, 2º D", ciudad: "Rosario", inquilino: "F. Acosta", finContrato: "2027-09-30" },
];

export async function cargarCarteraDemo(hoy = new Date()): Promise<Propiedad[]> {
  return Promise.all(
    CARTERA.map(async (p) => ({
      ...p,
      cuentas: await Promise.all(
        ORDEN_PROVEEDORES.map(async (proveedor, i) => {
          const identificador =
            proveedor === "api_santafe" ? p.partida : `${PROVEEDORES[proveedor].corto.toUpperCase()}-${p.id}-${1000 + i * 37}`;
          const cuenta = { id: `${p.id}-${proveedor}`, proveedor, identificador, ultimaConsulta: null };
          return { ...cuenta, ultimaConsulta: await consultarCuenta(cuenta, adaptadorSimulado(proveedor, hoy)) };
        }),
      ),
    })),
  );
}
