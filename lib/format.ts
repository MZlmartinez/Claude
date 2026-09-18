export function formatDayMonth(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("es-AR", { day: "2-digit" }),
    month: date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "").toUpperCase(),
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function formatPeriodLabel(periodDate: string): string {
  // periodDate: "2026-08-01" — se parsea como fecha local para evitar el
  // corrimiento de día que da new Date("2026-08-01") en UTC.
  const [year, month] = periodDate.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPercent(value: number): string {
  const formatted = Math.abs(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}${formatted} %`;
}
