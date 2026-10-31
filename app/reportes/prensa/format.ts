// Mismos formatos que el resto de los reportes "Moscú v2" — ver
// app/reportes/growth/format.ts para el precedente de este patrón.
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Num = number | null | undefined;

export function isNum(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

function compact(v: number) {
  return Math.abs(v) >= 1e6 ? nf1.format(v / 1e6) + " M" : Math.abs(v) >= 1e4 ? nf1.format(v / 1e3) + " k" : nf0.format(v);
}

export const F = {
  int: (v: Num) => (isNum(v) ? nf0.format(v) : "—"),
  compact: (v: Num) => (isNum(v) ? compact(v) : "—"),
  money: (v: Num) => (isNum(v) ? "$" + nf0.format(v) : "—"),
  moneyc: (v: Num) => (isNum(v) ? "$" + compact(v) : "—"),
  pct: (v: Num) => (isNum(v) ? nf1.format(v) + " %" : "—"),
  date: (v: string | null | undefined) =>
    typeof v === "string" && v.length >= 10 ? v.slice(8, 10) + "/" + v.slice(5, 7) + "/" + v.slice(0, 4) : "—",
  text: (v: unknown) => (v == null || v === "" ? "—" : String(v)),
};
