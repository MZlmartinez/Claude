"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Mismo mecanismo que AsistenteChat: avisa a Softr cuánto mide esta página
// (hasta un techo) para que agrande el iframe, y reenvía el scroll del
// mouse mientras el contenido entra entero. Hace falta acá también porque
// /asistente/guardados es una página server-side sin este código — sin
// esto el iframe se queda en el alto inicial y el resto queda invisible.
const MAX_FRAME_HEIGHT = 2400;

export default function PageHeightReporter({
  fontClassName,
  children,
}: {
  fontClassName: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      const height = Math.min(el.scrollHeight, MAX_FRAME_HEIGHT);
      window.parent.postMessage({ source: "coolmetrics-report", height }, "*");
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={`asis ${fontClassName}`} ref={rootRef}>
      {children}
    </div>
  );
}
