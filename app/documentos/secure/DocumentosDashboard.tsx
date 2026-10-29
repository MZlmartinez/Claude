"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./documentos.css";
import { FOLDER_MIME, formatDate, formatSize, isFolder, isShortcut, kindLabel } from "./format";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  shortcutTargetId: string | null;
  shortcutTargetMimeType: string | null;
};

// Un acceso directo "cuenta" como carpeta o como archivo según a qué
// apunte — nunca se sigue a ciegas: el id al que termina navegando o
// descargando pasa igual por isWithinRoot en el servidor (ver
// lib/googleDrive.ts), así que aunque el atajo apunte afuera del árbol
// del cliente, el peor caso es un error claro, no una fuga de datos.
function isEffectiveFolder(f: DriveFile): boolean {
  return isFolder(f.mimeType) || (isShortcut(f.mimeType) && f.shortcutTargetMimeType === FOLDER_MIME);
}
function openTargetId(f: DriveFile): string | null {
  if (isFolder(f.mimeType)) return f.id;
  if (isShortcut(f.mimeType) && f.shortcutTargetMimeType === FOLDER_MIME) return f.shortcutTargetId;
  return null;
}
function downloadTargetId(f: DriveFile): string | null {
  if (isFolder(f.mimeType)) return null;
  if (isShortcut(f.mimeType)) return f.shortcutTargetMimeType && f.shortcutTargetMimeType !== FOLDER_MIME ? f.shortcutTargetId : null;
  return f.id;
}

type Crumb = { id: string; name: string };

type Props = {
  email: string;
  token: string;
  fontClassName: string;
};

export default function DocumentosDashboard({ email, token, fontClassName }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "", name: "Documentos" }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentFolderId = crumbs[crumbs.length - 1].id;

  const load = useCallback(
    async (folderId: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ u: email, t: token });
        if (folderId) qs.set("folder", folderId);
        const res = await fetch(`/api/documentos/list?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo leer la carpeta.");
        setFiles(data.files ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo leer la carpeta.");
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [email, token],
  );

  useEffect(() => {
    // Igual que en Growth/Influencers: la navegación entre carpetas es
    // interactiva, no hay forma de precargar esto server-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(currentFolderId);
  }, [currentFolderId, load]);

  // Mismo patrón que Growth/Influencers (postMessage con la altura real):
  // a diferencia de /asistente (alto de iframe fijo, reportado una sola
  // vez), acá el contenido puede ser una sola fila o veinte, así que
  // conviene que el iframe se ajuste cada vez que cambia.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined" || window.parent === window) return;
    const post = () => window.parent.postMessage({ source: "coolmetrics-report", height: el.scrollHeight }, "*");
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, [files, loading, theme]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const openFolder = (f: DriveFile) => {
    const targetId = openTargetId(f);
    if (!targetId) return;
    setCrumbs((c) => [...c, { id: targetId, name: f.name }]);
  };
  const goToCrumb = (index: number) => setCrumbs((c) => c.slice(0, index + 1));

  const downloadHref = (fileId: string) =>
    `/api/documentos/download?${new URLSearchParams({ u: email, t: token, fileId }).toString()}`;

  const sorted = [...files].sort((a, b) => {
    const af = isEffectiveFolder(a) ? 0 : 1;
    const bf = isEffectiveFolder(b) ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.name.localeCompare(b.name, "es");
  });

  const folderCount = files.filter(isEffectiveFolder).length;
  const fileCount = files.length - folderCount;

  return (
    <div ref={rootRef} className={`doc ${fontClassName}`} data-theme={theme}>
      <div className="doc-layout">
        <header className="doc-head">
          <div className="doc-head-top">
            <span className="doc-kicker">
              <span className="doc-kicker-dot" aria-hidden="true" />
              Coolmetrics · Documentos
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
                    d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"
                    fill="#1d1d1b"
                  />
                </svg>
              </span>
              <div>
                <h1>Documentos</h1>
                <p className="doc-tagline">Carpetas y archivos compartidos con tu cuenta.</p>
              </div>
            </div>
            <div className="doc-hero-stats">
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k4)" }}>Carpetas</div>
                <div className="doc-hero-stat-value">{folderCount}</div>
              </div>
              <div className="doc-hero-stat">
                <div className="doc-hero-stat-label" style={{ color: "var(--doc-k1)" }}>Archivos</div>
                <div className="doc-hero-stat-value">{fileCount}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="doc-wrap">
          <nav className="doc-breadcrumb" aria-label="Ruta">
            {crumbs.map((c, i) =>
              i === crumbs.length - 1 ? (
                <span key={c.id || "root"} className="current">{c.name}</span>
              ) : (
                <span key={c.id || "root"}>
                  <button type="button" onClick={() => goToCrumb(i)}>{c.name}</button>
                  <span className="sep"> / </span>
                </span>
              ),
            )}
          </nav>

          {loading && <div className="doc-loading">Cargando…</div>}
          {!loading && error && <div className="doc-error">{error}</div>}
          {!loading && !error && sorted.length === 0 && <div className="doc-empty">Esta carpeta está vacía.</div>}

          {!loading && !error && sorted.length > 0 && (
            <div className="doc-list">
              {sorted.map((f) => {
                const folder = isEffectiveFolder(f);
                const downloadId = downloadTargetId(f);
                return (
                  <div key={f.id} className={`doc-row ${folder ? "doc-row-folder" : "doc-row-file"}`}>
                    <span className="doc-row-kind">{kindLabel(f.mimeType).slice(0, 4)}</span>
                    <span className="doc-row-name">
                      {folder ? (
                        <button type="button" className="doc-row-name-btn" onClick={() => openFolder(f)}>
                          {f.name}
                        </button>
                      ) : (
                        <span className="doc-row-name-text">{f.name}</span>
                      )}
                    </span>
                    {!folder && <span className="doc-row-meta">{formatSize(f.size)} · {formatDate(f.modifiedTime)}</span>}
                    <span className="doc-row-action">
                      {folder ? (
                        <button type="button" className="doc-row-name-btn" onClick={() => openFolder(f)}>Abrir</button>
                      ) : downloadId ? (
                        <a href={downloadHref(downloadId)} target="_blank" rel="noopener noreferrer">Abrir</a>
                      ) : (
                        <span className="muted">No disponible</span>
                      )}
                    </span>
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
