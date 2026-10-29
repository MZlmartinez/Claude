"use client";

import { useEffect, useRef, useState } from "react";
import "./agenda.css";

type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  meetLink: string | null;
  location: string | null;
};

type Props = {
  fontClassName: string;
  upcoming: CalendarEvent[];
  past: CalendarEvent[];
  calendarConfigured: boolean;
  error: string | null;
};

const MONTH_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function dateParts(iso: string | null): { day: string; month: string } {
  if (!iso) return { day: "—", month: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: "—", month: "" };
  return { day: String(d.getDate()).padStart(2, "0"), month: MONTH_LABELS[d.getMonth()] };
}
function timeOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function MeetingRow({ ev, action }: { ev: CalendarEvent; action: React.ReactNode }) {
  const { day, month } = dateParts(ev.start);
  const platform = ev.meetLink ? "Google Meet" : ev.location || "—";
  return (
    <div className="doc-agenda-row">
      <div className="doc-agenda-date">
        <span className="doc-agenda-date-month">{month}</span>
        <span className="doc-agenda-date-day">{day}</span>
      </div>
      <div className="doc-agenda-info">
        <div className="doc-agenda-title">{ev.title}</div>
        <div className="doc-agenda-meta">{timeOf(ev.start)} · {platform}</div>
      </div>
      {action}
    </div>
  );
}

export default function AgendaDashboard({ fontClassName, upcoming, past, calendarConfigured, error }: Props) {
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
  }, [theme, upcoming, past]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const thisMonthCount = upcoming.filter((ev) => isThisMonth(ev.start)).length;

  const joinAction = (ev: CalendarEvent) =>
    ev.meetLink ? (
      <a className="doc-agenda-icon" href={ev.meetLink} target="_blank" rel="noopener noreferrer" aria-label="Unirse a la videollamada">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <path
            d="M15 8l5-3v14l-5-3M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
            stroke="currentColor"
            strokeWidth={1.6}
            fill="none"
          />
        </svg>
      </a>
    ) : null;

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

          <div className="doc-hero doc-hero-compact">
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
                <div className="doc-hero-stat-value">{upcoming.length}</div>
              </div>
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k4)" }}>Este mes</div>
                <div className="doc-hero-stat-value">{thisMonthCount}</div>
              </div>
            </div>
          </div>
        </header>

        {!calendarConfigured && (
          <div className="doc-wrap">
            <div className="doc-empty">Este cliente todavía no tiene un calendario de Agenda configurado.</div>
          </div>
        )}

        {calendarConfigured && error && (
          <div className="doc-wrap">
            <div className="doc-error">No pudimos leer el calendario: {error}</div>
          </div>
        )}

        {calendarConfigured && !error && (
          <>
            <div className="doc-wrap">
              <div className="doc-section-head">
                <h2 className="doc-section-title">Próximos encuentros</h2>
              </div>

              {upcoming.length === 0 ? (
                <div className="doc-empty">No tenés reuniones próximas agendadas.</div>
              ) : (
                <div className="doc-agenda-list">
                  {upcoming.map((ev) => (
                    <MeetingRow key={ev.id} ev={ev} action={joinAction(ev)} />
                  ))}
                </div>
              )}
            </div>

            <div className="doc-wrap">
              <div className="doc-section-head">
                <h2 className="doc-section-title">Reuniones anteriores</h2>
              </div>

              {past.length === 0 ? (
                <div className="doc-empty">Todavía no hubo reuniones.</div>
              ) : (
                <div className="doc-agenda-list">
                  {past.map((ev) => (
                    <MeetingRow key={ev.id} ev={ev} action={null} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
