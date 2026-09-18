"use client";

import { useState } from "react";
import { formatPercent, formatPeriodLabel } from "@/lib/format";
import type { InsightOfMonth, Metric } from "@/lib/types";

const SENTIMENT_COLOR: Record<Metric["sentiment"], string> = {
  positive: "bg-[var(--accent)]",
  negative: "bg-[var(--danger)]",
  neutral: "bg-white/30",
};

type PerformanceSnapshotProps = {
  periods: string[];
  metricsByPeriod: Record<string, Metric[]>;
  insightByPeriod: Record<string, InsightOfMonth>;
};

export function PerformanceSnapshot({
  periods,
  metricsByPeriod,
  insightByPeriod,
}: PerformanceSnapshotProps) {
  const [selected, setSelected] = useState(periods[0]);

  if (periods.length === 0) {
    return null;
  }

  const metrics = metricsByPeriod[selected] ?? [];
  const insight = insightByPeriod[selected];

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-sm text-[var(--accent)]">Perfomance snapshot</h2>
          <span className="text-sm text-white/50">vs. período anterior</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelected(period)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                period === selected
                  ? "bg-white text-[#181818]"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {formatPeriodLabel(period)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <span className={`inline-block h-4 w-4 rounded-md ${SENTIMENT_COLOR[metric.sentiment]}`} />
            <p className="mt-3 text-xs tracking-wide text-white/50 uppercase">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{formatPercent(metric.value_pct)}</p>
          </div>
        ))}
      </div>

      {insight && (
        <div className="mt-6">
          <h2 className="font-heading text-sm text-[var(--accent)]">Insight del mes</h2>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p
              className="text-base font-extrabold text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {insight.title}
            </p>
            <p className="mt-2 text-sm text-white/70">{insight.body}</p>
            {insight.highlight && (
              <p className="mt-4 flex items-start gap-2 text-sm text-white">
                <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm bg-[var(--accent)]" />
                {insight.highlight}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
