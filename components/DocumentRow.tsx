import type { DocumentItem } from "@/lib/types";

export function DocumentRow({ document }: { document: DocumentItem }) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 transition hover:bg-white/5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{document.name}</p>
        {document.kind && <p className="text-xs text-white/50">{document.kind}</p>}
      </div>
    </a>
  );
}
