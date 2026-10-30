import { ORDEN_PROVEEDORES, PROVEEDORES } from "@/lib/morosidad/proveedores";
import { MorosidadHeader } from "../ui";

// Prototipo: muestra el formato de carga inicial. La importación real valida
// cada fila (dígito verificador de la partida y de cada cuenta) antes de
// insertar, y detecta propiedades repetidas por partida.
const COLUMNAS = [
  { col: "partida", desc: "Partida inmobiliaria (API Santa Fe). Identifica la propiedad.", obligatoria: true },
  { col: "direccion", desc: "Calle, número, piso y depto.", obligatoria: true },
  { col: "ciudad", desc: "Por ahora solo Rosario.", obligatoria: true },
  { col: "inquilino", desc: "Nombre del inquilino actual (vacío si está desocupada).", obligatoria: false },
  { col: "fin_contrato", desc: "AAAA-MM-DD. Sirve para priorizar alertas antes de devolver el depósito.", obligatoria: false },
  ...ORDEN_PROVEEDORES.filter((id) => id !== "api_santafe").map((id) => ({
    col: id,
    desc: `${PROVEEDORES[id].identificadorLabel} — ${PROVEEDORES[id].nombre}`,
    obligatoria: false,
  })),
];

export default function ImportarPage() {
  const ejemplo = [
    COLUMNAS.map((c) => c.col).join(","),
    "16-03-00-741203/0001-4,Córdoba 1452 3º B,Rosario,M. Gómez,2027-03-31,123456/7,0012345678,987654,55443322",
  ].join("\n");

  return (
    <div className="flex flex-1 flex-col">
      <MorosidadHeader actual="importar" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <h1 className="font-heading text-3xl text-white">Cargar propiedades</h1>
        <p className="mt-2 text-white/60">
          La inmobiliaria sube un CSV con una fila por propiedad. Después de la carga, el sistema consulta cada cuenta
          periódicamente y actualiza el tablero.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {COLUMNAS.map((c) => (
                <tr key={c.col} className="border-t border-white/5 first:border-0">
                  <td className="w-40 px-4 py-2.5 font-mono text-[var(--accent)]">{c.col}</td>
                  <td className="px-4 py-2.5 text-white/70">{c.desc}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-white/40">{c.obligatoria ? "obligatoria" : "opcional"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-sm text-white/50">Ejemplo:</p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">{ejemplo}</pre>

        <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/40">
          Subir CSV — disponible cuando esté conectada la base de datos.
        </div>
      </main>
    </div>
  );
}
