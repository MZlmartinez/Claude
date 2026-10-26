"use client";

import { useEffect, useState } from "react";

// Mismo encabezado en /asistente, /asistente/guardados y
// /asistente/guardados/[id] — antes estaba copiado a mano en cada página
// (con textos distintos) y se desalineaba apenas se tocaba uno solo.
export function AsistenteHeader({ savedCount }: { savedCount: number }) {
  // El toggle vive acá adentro (en vez de recibir el tema por prop) para no
  // tener que pasar estado a través de AsistenteChat y de las dos páginas
  // de guardados, que no comparten ningún componente padre en común. El
  // contenedor .asis es ancestro directo de este header en las tres
  // páginas — alcanza con setearle el atributo, las variables CSS
  // (asistente.css) cascadean solas.
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".asis");
    root?.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <header className="asis-head">
      <div className="asis-head-top">
        <span className="asis-kicker">
          <span className="asis-kicker-dot" aria-hidden="true" />
          Coolmetrics · Asistente
        </span>
        <div className="asis-theme" role="group" aria-label="Tema">
          <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
            Oscura
          </button>
          <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
            Clara
          </button>
        </div>
      </div>

      {/* Siempre oscuro (ver asistente.css) — como la tarjeta "resumen" de
          growth/influencers, que tampoco cambia con el toggle. */}
      <div className="asis-hero">
        <div className="asis-hero-top">
          <span className="asis-hero-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" fill="#1d1d1b" />
            </svg>
          </span>
          <div>
            <h1>Asistente de datos</h1>
            <p className="asis-tagline">Tu negocio, a una pregunta de distancia.</p>
          </div>
        </div>
        <div className="asis-hero-stats">
          <div className="asis-hero-stat">
            <div className="asis-hero-stat-label" style={{ color: "var(--asis-k1)" }}>
              Guardados
            </div>
            <div className="asis-hero-stat-value">{savedCount}</div>
            <div className="asis-hero-stat-sub">reportes</div>
          </div>
          <div className="asis-hero-stat">
            <div className="asis-hero-stat-label" style={{ color: "var(--asis-k2)" }}>
              Sugerencias
            </div>
            {/* Mismo número que el array de sugerencias en AsistenteChat.tsx. */}
            <div className="asis-hero-stat-value">3</div>
            <div className="asis-hero-stat-sub">para probar</div>
          </div>
        </div>
      </div>
    </header>
  );
}
