// Formatos numéricos calcados del reporte original hecho en claude.ai
// (mismos cortes/unidades que su objeto `F`, para que los números se vean igual).
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Num = number | null | undefined;

function isNum(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

export const F = {
  int: (v: Num) => (isNum(v) ? nf0.format(v) : "—"),
  compact: (v: Num) =>
    !isNum(v)
      ? "—"
      : Math.abs(v) >= 1e6
        ? nf1.format(v / 1e6) + " M"
        : Math.abs(v) >= 1e4
          ? nf1.format(v / 1e3) + " k"
          : nf0.format(v),
  money: (v: Num) => (isNum(v) ? "$" + nf0.format(v) : "—"),
  moneyc: (v: Num) => (!isNum(v) ? "—" : "$" + F.compact(v)),
  pct: (v: Num) => (isNum(v) ? nf2.format(v) + " %" : "—"),
  date: (v: string | null | undefined) =>
    typeof v === "string" && v.length >= 10
      ? v.slice(8, 10) + "/" + v.slice(5, 7) + "/" + v.slice(0, 4)
      : "—",
  text: (v: unknown) => (v == null ? "—" : String(v)),
};

export { isNum };
