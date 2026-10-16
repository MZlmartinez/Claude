"use client";

import { useState } from "react";

const BIG_TABLES = [
  "gold_shopify_sessions_by_referrer",
  "gold_shopify_sessions_by_referrer_master",
] as const;

type LogEntry = {
  text: string;
  kind: "ok" | "retry" | "error";
};

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BackfillPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [database, setDatabase] = useState("");
  const [from, setFrom] = useState("2025-09-01");
  const [to, setTo] = useState("2026-09-26");
  const [tables, setTables] = useState<string[]>([...BIG_TABLES]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  function pushLog(entry: LogEntry) {
    setLog((prev) => [...prev, entry]);
  }

  async function runBackfill() {
    setRunning(true);
    setLog([]);

    for (const table of tables) {
      let cursor = from;
      let windowDays = 14;

      while (cursor < to) {
        const chunkTo = addDays(cursor, windowDays) > to ? to : addDays(cursor, windowDays);
        const url = `${baseUrl.replace(/\/$/, "")}/api/sync-gold?key=${encodeURIComponent(secretKey)}&endpoint=${encodeURIComponent(endpoint)}&database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}&from=${cursor}&to=${chunkTo}`;

        try {
          const res = await fetch(url);

          if (res.status === 504 || res.status === 502) {
            if (windowDays <= 1) {
              pushLog({
                text: `${table} ${cursor}→${chunkTo}: timeout incluso con 1 día. Frená y avisale a Claude.`,
                kind: "error",
              });
              setRunning(false);
              return;
            }
            windowDays = Math.max(1, Math.floor(windowDays / 2));
            pushLog({
              text: `${table} ${cursor}→${chunkTo}: timeout, achico el tramo a ${windowDays} día(s) y reintento.`,
              kind: "retry",
            });
            continue;
          }

          const data = await res.json();

          if (!res.ok || data.ok !== true) {
            pushLog({
              text: `${table} ${cursor}→${chunkTo}: error — ${JSON.stringify(data)}`,
              kind: "error",
            });
            setRunning(false);
            return;
          }

          const rows = data.results?.[table]?.rows ?? 0;
          const tableError = data.results?.[table]?.error;

          if (tableError) {
            // Timeout de Postgres (statement_timeout) o similar: el tramo
            // era muy grande para ese pedazo puntual, no un error de datos.
            // Tratarlo igual que el 504: achicar y reintentar.
            if (windowDays <= 1) {
              pushLog({
                text: `${table} ${cursor}→${chunkTo}: error incluso con 1 día — ${tableError}`,
                kind: "error",
              });
              setRunning(false);
              return;
            }
            windowDays = Math.max(1, Math.floor(windowDays / 2));
            pushLog({
              text: `${table} ${cursor}→${chunkTo}: error (${tableError}), achico el tramo a ${windowDays} día(s) y reintento.`,
              kind: "retry",
            });
            continue;
          }

          pushLog({ text: `${table} ${cursor}→${chunkTo}: ${rows} filas`, kind: "ok" });
          cursor = chunkTo;
        } catch (err) {
          pushLog({ text: `${table} ${cursor}→${chunkTo}: ${String(err)}`, kind: "error" });
          setRunning(false);
          return;
        }
      }
    }

    pushLog({ text: "Listo, backfill completo.", kind: "ok" });
    setRunning(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-2 text-xl font-semibold">Backfill histórico (gold)</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Carga el historial completo de las tablas grandes en tramos de fecha, achicando el
        tramo solo si alguno tarda demasiado. Dejá esta pestaña abierta hasta que termine.
      </p>

      <div className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="URL del deploy (ej. https://claude-ecru-three.vercel.app)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="TEST_ROUTE_SECRET"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="endpoint SQL de Fabric"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="database (ej. LH_Deca_Negocio)"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        />
        <div className="flex gap-3">
          <input
            className="w-1/2 rounded border px-3 py-2"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="w-1/2 rounded border px-3 py-2"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          {BIG_TABLES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tables.includes(t)}
                onChange={(e) =>
                  setTables((prev) =>
                    e.target.checked ? [...prev, t] : prev.filter((x) => x !== t),
                  )
                }
              />
              {t}
            </label>
          ))}
        </div>

        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={running || !baseUrl || !secretKey || !endpoint || !database}
          onClick={runBackfill}
        >
          {running ? "Corriendo..." : "Iniciar backfill"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-1 font-mono text-xs">
        {log.map((entry, i) => (
          <div
            key={i}
            className={
              entry.kind === "error"
                ? "text-red-600"
                : entry.kind === "retry"
                  ? "text-amber-600"
                  : "text-neutral-700"
            }
          >
            {entry.text}
          </div>
        ))}
      </div>
    </main>
  );
}
