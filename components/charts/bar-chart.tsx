"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompact, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface BarChartSeries {
  name: string;
  color: string;
}

export interface BarChartGroup {
  label: string;
  values: number[];
}

interface BarChartProps {
  groups: BarChartGroup[];
  series: BarChartSeries[];
  height?: number;
  ariaLabel: string;
  emptyText?: string;
  className?: string;
}

const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";

function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const f = max / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Rectangle with 4px rounded top corners, square at the baseline. */
function roundedTopRect(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(radius, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Grouped column chart (SVG). Follows the data-viz method: ≤24px columns, rounded
 * data-ends, 2px surface gap, hairline gridlines, legend for ≥2 series, hover tooltip.
 */
// Values are money amounts; formatting lives here because functions cannot cross the server → client boundary.
const formatValue = (v: number) => formatMoney(v);
const formatTick = (v: number) => formatCompact(v);

export function BarChart({ groups, series, height = 240, ariaLabel, emptyText = "No data for this period", className }: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 12, bottom: 28, left: 52 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const maxVal = Math.max(0, ...groups.flatMap((g) => g.values.map((v) => (Number.isFinite(v) ? v : 0))));
  const yMax = niceCeil(maxVal);
  const tickCount = 4;
  const y = (v: number) => pad.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const groupW = plotW / Math.max(1, groups.length);
  const gap = 2;
  const barW = Math.min(24, Math.max(3, (groupW * 0.72 - gap * (series.length - 1)) / series.length));
  const clusterW = barW * series.length + gap * (series.length - 1);
  const allZero = maxVal === 0;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {series.length > 1 ? (
        <div className="mb-2 flex flex-wrap justify-end gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}

      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const v = (yMax * i) / tickCount;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke={i === 0 ? BASELINE : GRID} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={pad.left - 8} y={yy + 3.5} textAnchor="end" fontSize={11} fill={INK_MUTED} className="tabular">
                {formatTick(v)}
              </text>
            </g>
          );
        })}

        {groups.map((g, gi) => {
          const groupX = pad.left + gi * groupW;
          const x0 = groupX + (groupW - clusterW) / 2;
          const dim = hover !== null && hover !== gi;
          return (
            <g key={g.label} opacity={dim ? 0.55 : 1} style={{ transition: "opacity 120ms" }}>
              {series.map((s, si) => {
                const v = g.values[si] ?? 0;
                const top = y(v);
                const h = y(0) - top;
                return <path key={s.name} d={roundedTopRect(x0 + si * (barW + gap), top, barW, h, 4)} fill={s.color} />;
              })}
              <text x={groupX + groupW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={INK_MUTED}>
                {g.label}
              </text>
              <rect
                x={groupX}
                y={pad.top}
                width={groupW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(gi)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(gi)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${g.label}: ${series.map((s, si) => `${s.name} ${formatValue(g.values[si] ?? 0)}`).join(", ")}`}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && groups[hover] ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
          style={{ left: pad.left + hover * groupW + groupW / 2, top: pad.top }}
        >
          <p className="mb-1 font-semibold text-foreground">{groups[hover].label}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.name}
              </span>
              <span className="tabular font-medium text-foreground">{formatValue(groups[hover].values[si] ?? 0)}</span>
            </p>
          ))}
        </div>
      ) : null}

      {allZero ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{emptyText}</div>
      ) : null}
    </div>
  );
}
