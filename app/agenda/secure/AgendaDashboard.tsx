"use client";

import { useEffect, useRef, useState } from "react";
import "./agenda.css";

type Props = {
  fontClassName: string;
};

type MeetingEvent = {
  id: string;
  title: string;
  date: string; // "05 NOV"
  time: string; // "10:00"
  platform: string; // "Google Meet"
  meetLink: string | null;
};

// Datos de ejemplo nomás — para validar el diseño antes de conectar el
// calendario real (ver la charla pendiente sobre un calendario de Google
// por cliente en vez de uno compartido con todos). Mismo shape que
// tendría un evento real, para que enchufar datos de verdad después sea
// solo reemplazar este array por el fetch correspondiente.
const MOCK_EVENTS: MeetingEvent[] = [
  { id: "1", title: "Revisión mensual de resultados", date: "05 NOV", time: "10:00", platform: "Google Meet", meetLink: "#" },
  { id: "2", title: "Seguimiento de estrategia", date: "19 NOV", time: "15:30", platform: "Google Meet", meetLink: "#" },
];

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

  const events = MOCK_EVENTS;
  const splitDate = (s: string) => s.split(" ");

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
                <p className="doc-tagline">Tus próximos encuentros con Moscú.</p>
              </div>
            </div>
            <div className="doc-hero-stats">
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k1)" }}>Próximas</div>
                <div className="doc-hero-stat-value">{events.length}</div>
              </div>
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k4)" }}>Este mes</div>
                <div className="doc-hero-stat-value">{events.length}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-wrap">
          <h2 className="doc-section-title">Próximos encuentros</h2>

          {events.length === 0 ? (
            <div className="doc-empty">No tenés reuniones próximas agendadas.</div>
          ) : (
            <div className="doc-agenda-list">
              {events.map((ev) => {
                const [day, month] = splitDate(ev.date);
                return (
                  <div key={ev.id} className="doc-agenda-row">
                    <div className="doc-agenda-date">
                      <span className="doc-agenda-date-month">{month}</span>
                      <span className="doc-agenda-date-day">{day}</span>
                    </div>
                    <div className="doc-agenda-info">
                      <div className="doc-agenda-title">{ev.title}</div>
                      <div className="doc-agenda-meta">{ev.time} · {ev.platform}</div>
                    </div>
                    {ev.meetLink && (
                      <a
                        className="doc-agenda-icon"
                        href={ev.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Unirse a la videollamada"
                      >
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <path
                            d="M15 8l5-3v14l-5-3M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
                            stroke="currentColor"
                            strokeWidth={1.6}
                            fill="none"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
