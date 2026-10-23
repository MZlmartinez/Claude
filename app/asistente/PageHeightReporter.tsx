"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Mismo mecanismo que AsistenteChat: avisa a Softr un alto FIJO (una sola
// vez, al montar) y reenvía el scroll del mouse mientras el contenido
// entra entero. Hace falta acá también porque /asistente/guardados es una
// página server-side sin este código — sin esto el iframe se queda en el
// alto inicial de Softr y el resto queda invisible.
const FRAME_HEIGHT = 880;

export default function PageHeightReporter({
  fontClassName,
  children,
}: {
  fontClassName: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.parent.postMessage({ source: "coolmetrics-report", height: FRAME_HEIGHT }, "*");
  }, []);

  // Igual que en AsistenteChat: solo reenviar el scroll a Softr cuando
  // .asis ya no tiene margen para scrollear internamente en esa
  // dirección — reenviarlo siempre, aun scrolleando de forma nativa por
  // haber pasado el tope, duplicaba el movimiento y rompía el sidebar
  // sticky de Softr.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
      window.parent.postMessage({ source: "coolmetrics-report", wheelDeltaY: e.deltaY }, "*");
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={`asis ${fontClassName}`} ref={rootRef}>
      {children}
    </div>
  );
}
