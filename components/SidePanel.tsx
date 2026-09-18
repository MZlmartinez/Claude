import Link from "next/link";
import type { ReactNode } from "react";

type SidePanelProps = {
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
};

export function SidePanel({
  title,
  viewAllHref,
  viewAllLabel,
  isEmpty,
  emptyMessage,
  children,
}: SidePanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm text-white">{title}</h2>
        <Link href={viewAllHref} className="text-xs text-[var(--accent)] hover:underline">
          {viewAllLabel} →
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {isEmpty ? (
          <p className="py-4 text-sm text-white/40">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
