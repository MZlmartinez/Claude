"use client";

import { useEffect, useState } from "react";

// Mismo encabezado en /asistente, /asistente/guardados y
// /asistente/guardados/[id] — antes estaba copiado a mano en cada página
// (con textos distintos) y se desalineaba apenas se tocaba uno solo.
export function AsistenteHeader() {
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
      <div className="asis-head-text">
        <div className="asis-head-top">
          <span className="asis-spark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" fill="currentColor" />
            </svg>
          </span>
          <span className="asis-kicker">Coolmetrics</span>
          <div className="asis-theme" role="group" aria-label="Tema">
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
              Oscura
            </button>
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
              Clara
            </button>
          </div>
        </div>
        <h1>Asistente de datos</h1>
        <p className="asis-tagline">Tu negocio, a una pregunta de distancia.</p>
      </div>

      <svg className="asis-head-art" viewBox="0 0 120 100" aria-hidden="true">
        <circle cx="60" cy="50" r="46" fill="none" stroke="var(--asis-line)" strokeWidth="1" />
        <rect x="24" y="62" width="10" height="20" rx="2" fill="var(--asis-k1)" />
        <rect x="40" y="48" width="10" height="34" rx="2" fill="var(--asis-accent)" />
        <rect x="56" y="58" width="10" height="24" rx="2" fill="var(--asis-k2)" />
        <rect x="72" y="38" width="10" height="44" rx="2" fill="var(--asis-k3)" />
        <circle cx="77" cy="26" r="4" fill="var(--asis-accent)" />
        <circle cx="29" cy="30" r="2.5" fill="var(--asis-k1)" />
      </svg>
    </header>
  );
}
