"use client";

import { useEffect, useRef, useState } from "react";
import "./agenda.css";

type Props = {
  fontClassName: string;
};

// Cáscara nomás, todavía sin datos: mismo patrón de Documentos
// (app/documentos/secure/DocumentosDashboard.tsx) — header + hero +
// tarjeta, candado de identidad ya resuelto en page.tsx, postMessage con
// la altura real. Falta conectar la fuente de datos real de la agenda
// (ver ds.agenda en el bloque de Home de Softr, que ya referencia una
// tabla "agenda" en Airtable) y reemplazar el estado vacío de abajo por
// la lista de reuniones.
export default function AgendaDashboard({ fontClassName }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined" || window.parent === window) return;
    const post = () => window.parent.postMessage({ source: "coolmetrics-report", height: el.scrollHeight }, "*");
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={rootRef} className={`doc ${fontClassName}`} data-theme={theme}>
      <div className="doc-layout">
        <header className="doc-head">
          <div className="doc-head-top">
            <span className="doc-kicker">
              <span className="doc-kicker-dot" aria-hidden="true" />
              Coolmetrics · Agenda
            </span>
            <div className="doc-theme" role="group" aria-label="Tema">
              <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Oscura</button>
              <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Clara</button>
            </div>
          </div>

          <div className="doc-hero">
            <div className="doc-hero-top">
              <span className="doc-hero-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 3v2M17 3v2M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
                    stroke="#1d1d1b"
                    strokeWidth={1.6}
                    fill="none"
                  />
                </svg>
              </span>
              <div>
                <h1>Agenda</h1>
                <p className="doc-tagline">Próximas reuniones con tu equipo.</p>
              </div>
            </div>
            <div className="doc-hero-stats">
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k1)" }}>Próximas</div>
                <div className="doc-hero-stat-value">—</div>
              </div>
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k4)" }}>Este mes</div>
                <div className="doc-hero-stat-value">—</div>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-wrap">
          <div className="doc-empty">Todavía no conectamos las reuniones reales acá.</div>
        </div>
      </div>
    </div>
  );
}
