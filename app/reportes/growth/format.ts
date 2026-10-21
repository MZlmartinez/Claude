// Formatos calcados del objeto F/D del artifact original de claude.ai para
// este reporte (mismos cortes/unidades, para que los números se vean igual).
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Num = number | null | undefined;

function isNum(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

function compact(v: number) {
  return Math.abs(v) >= 1e6 ? nf1.format(v / 1e6) + " M" : Math.abs(v) >= 1e4 ? nf1.format(v / 1e3) + " k" : nf0.format(v);
}

function sign(v: number, s: string) {
  return (v > 0 ? "+" : v < 0 ? "−" : "") + s;
}

export const F = {
  int: (v: Num) => (isNum(v) ? nf0.format(v) : "—"),
  compact: (v: Num) => (isNum(v) ? compact(v) : "—"),
  money: (v: Num) => (isNum(v) ? "$" + nf0.format(v) : "—"),
  moneyc: (v: Num) => (isNum(v) ? "$" + compact(v) : "—"),
  // ya viene multiplicado por 100 desde el SQL (0-100), a diferencia de pct
  pctNum: (v: Num) => (isNum(v) ? nf2.format(v) + " %" : "—"),
  // viene en fracción (0-1): se multiplica acá
  pct: (v: Num) => (isNum(v) ? nf1.format(v * 100) + " %" : "—"),
  pct2: (v: Num) => (isNum(v) ? nf2.format(v * 100) + " %" : "—"),
  x: (v: Num) => (isNum(v) ? nf1.format(v) + "x" : "—"),
  date: (v: string | null | undefined) =>
    typeof v === "string" && v.length >= 10 ? v.slice(8, 10) + "/" + v.slice(5, 7) + "/" + v.slice(0, 4) : "—",
  text: (v: unknown) => (v == null ? "—" : String(v)),
};

// Deltas (variaciones): con signo explícito (+/−).
export const D = {
  pct: (v: Num) => (isNum(v) ? sign(v, nf1.format(Math.abs(v) * 100) + " %") : "—"),
  pp: (v: Num) => (isNum(v) ? sign(v, nf1.format(Math.abs(v) * 100) + " pp") : "—"),
  ppNum: (v: Num) => (isNum(v) ? sign(v, nf2.format(Math.abs(v)) + " pp") : "—"),
  x: (v: Num) => (isNum(v) ? sign(v, nf1.format(Math.abs(v)) + "x") : "—"),
};

export { isNum, compact };
