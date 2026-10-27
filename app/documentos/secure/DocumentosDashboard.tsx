"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./documentos.css";
import { formatDate, formatSize, isFolder, isShortcut, kindLabel } from "./format";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
};

type Crumb = { id: string; name: string };

type Props = {
  email: string;
  token: string;
  fontClassName: string;
};

export default function DocumentosDashboard({ email, token, fontClassName }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
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
    // La navegación entre carpetas es interactiva (no se sabe de antemano
    // qué subcarpeta va a abrir el usuario) — no hay forma de precargar
    // esto server-side como en Influencers/Growth, así que el fetch tiene
    // que vivir acá.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(currentFolderId);
  }, [currentFolderId, load]);

  // Mismo patrón que los demás reportes embebidos en Softr (ver
  // app/reportes/influencers/InfluencersDashboard.tsx): le avisa al padre
  // cuánto mide el contenido, y reenvía el scroll de la rueda del mouse.
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

  const openFolder = (f: DriveFile) => setCrumbs((c) => [...c, { id: f.id, name: f.name }]);
  const goToCrumb = (index: number) => setCrumbs((c) => c.slice(0, index + 1));

  const downloadHref = (fileId: string) =>
    `/api/documentos/download?${new URLSearchParams({ u: email, t: token, fileId }).toString()}`;

  const sorted = [...files].sort((a, b) => {
    const af = isFolder(a.mimeType) ? 0 : 1;
    const bf = isFolder(b.mimeType) ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.name.localeCompare(b.name, "es");
  });

  return (
    <div ref={rootRef} className={`mx ${fontClassName}`} data-theme={theme}>
      <div className="mx-wrap">
        <header>
          <div className="mx-top">
            <div>
              <div className="mx-kicker">MOSCÚ · Framework desk</div>
              <h1 className="mx-title">Documentos</h1>
            </div>
            <div className="mx-theme" role="group" aria-label="Tema">
              <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Oscura</button>
              <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Clara</button>
            </div>
          </div>
          <p className="mx-sub">Carpetas y archivos compartidos con tu cuenta.</p>
        </header>

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

        <div className="doc-card">
          <div className="doc-row is-head">
            <span />
            <span>Nombre</span>
            <span>Tamaño</span>
            <span className="doc-col-date">Modificado</span>
            <span></span>
          </div>

          {loading && <div className="doc-loading">Cargando…</div>}
          {!loading && error && <div className="doc-error">{error}</div>}
          {!loading && !error && sorted.length === 0 && <div className="doc-empty">Esta carpeta está vacía.</div>}
          {!loading &&
            !error &&
            sorted.map((f) => {
              const folder = isFolder(f.mimeType);
              const shortcut = isShortcut(f.mimeType);
              return (
                <div key={f.id} className="doc-row">
                  <span className="doc-icon">{kindLabel(f.mimeType).slice(0, 3).toUpperCase()}</span>
                  <span className="doc-name">
                    {folder ? (
                      <button type="button" className="doc-name-btn" onClick={() => openFolder(f)}>
                        {f.name}
                      </button>
                    ) : (
                      f.name
                    )}
                  </span>
                  <span className="doc-meta">{folder ? "—" : formatSize(f.size)}</span>
                  <span className="doc-meta doc-col-date">{formatDate(f.modifiedTime)}</span>
                  <span className="doc-action">
                    {folder ? (
                      <button type="button" className="doc-name-btn" onClick={() => openFolder(f)}>Abrir</button>
                    ) : shortcut ? (
                      <span className="muted">No disponible</span>
                    ) : (
                      <a href={downloadHref(f.id)} target="_blank" rel="noopener noreferrer">Abrir</a>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
