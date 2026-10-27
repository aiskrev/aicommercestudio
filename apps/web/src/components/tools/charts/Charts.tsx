"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cx } from "@/components/ui/primitives";

/* Small, dependency-free charts for the tools. Conventions (dataviz skill): categorical series use
   --color-viz-1…3 in fixed order; thin marks with 4px rounded data-ends; hairline recessive grid;
   text in text tokens, never the series colour; a legend for ≥ 2 series plus selective direct labels;
   a hover/focus tooltip that only repeats values also available in a table or label. */

export const SERIES_COLOURS = ["var(--color-viz-1)", "var(--color-viz-2)", "var(--color-viz-3)"] as const;

export function Legend({ items }: { items: { key: string; label: string; colour: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-secondary">
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={item.line ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ background: item.colour }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, y, children, containerWidth }: { x: number; y: number; children: ReactNode; containerWidth: number }) {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-36 rounded-[var(--radius-md)] border border-line-default bg-surface-2 px-3 py-2 text-xs shadow-lg"
      style={{ left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined, top: Math.max(0, y - 12) }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------- stacked bars

export interface StackedBar {
  key: string;
  label: string;
  /** Segment values in series order (non-negative). */
  values: number[];
  total: string;
}

/**
 * Horizontal stacked bars (≤ 3 series) with a 2px surface gap between segments, the total at the
 * bar tip and a per-segment tooltip. Every value is also in the result list beside the chart.
 */
export function StackedBars({
  bars,
  series,
  format,
  label,
}: {
  bars: StackedBar[];
  series: { key: string; label: string }[];
  format: (value: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.values.reduce((s, v) => s + Math.max(0, v), 0)));
  const [tip, setTip] = useState<{ x: number; y: number; bar: number; segment: number; width: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  return (
    <figure className="grid gap-3" aria-label={label}>
      <Legend items={series.map((s, i) => ({ key: s.key, label: s.label, colour: SERIES_COLOURS[i] }))} />
      <div ref={box} className="relative grid gap-4" onPointerLeave={() => setTip(null)}>
        {bars.map((bar, b) => (
          <div key={bar.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
            <span className="text-sm text-fg-secondary">{bar.label}</span>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-6 min-w-0 gap-[2px]" style={{ width: `calc(${(bar.values.reduce((s, v) => s + Math.max(0, v), 0) / max) * 100}% - 4.5rem)` }}>
                {bar.values.map((value, s) =>
                  value > 0 ? (
                    <span
                      key={series[s].key}
                      tabIndex={0}
                      aria-label={`${bar.label}, ${series[s].label}: ${format(value)}`}
                      className={cx("h-full outline-none focus-visible:ring-2 focus-visible:ring-fg", s === bar.values.length - 1 || bar.values.slice(s + 1).every((v) => v <= 0) ? "rounded-r-[4px]" : "")}
                      style={{ flexGrow: value, flexBasis: 0, minWidth: 2, background: SERIES_COLOURS[s] }}
                      onPointerMove={(event: PointerEvent<HTMLSpanElement>) => {
                        const rect = box.current!.getBoundingClientRect();
                        setTip({ x: event.clientX - rect.left, y: event.clientY - rect.top, bar: b, segment: s, width: rect.width });
                      }}
                      onFocus={(event) => {
                        const rect = box.current!.getBoundingClientRect();
                        const own = event.currentTarget.getBoundingClientRect();
                        setTip({ x: own.left - rect.left + own.width / 2, y: own.top - rect.top, bar: b, segment: s, width: rect.width });
                      }}
                      onBlur={() => setTip(null)}
                    />
                  ) : null,
                )}
              </div>
              <span className="shrink-0 font-mono text-sm text-fg">{bar.total}</span>
            </div>
          </div>
        ))}
        {tip && (
          <Tooltip x={tip.x} y={tip.y} containerWidth={tip.width}>
            <span className="block font-semibold text-fg">{format(bars[tip.bar].values[tip.segment])}</span>
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: SERIES_COLOURS[tip.segment] }} />
              {series[tip.segment].label} · {bars[tip.bar].label}
            </span>
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------------- line chart

/**
 * Lines over months on one axis (≤ 3 series), zero baseline emphasised, optional marker per series
 * (e.g. payback), direct end labels, and a crosshair tooltip listing every series for the month
 * under the pointer or the focused month (arrow keys).
 */
export function LineChart({
  series,
  months,
  format,
  label,
  monthLabel,
  markerLabel,
}: {
  series: { key: string; label: string; values: number[]; marker?: number | null }[];
  months: number;
  format: (value: number) => string;
  label: string;
  monthLabel: (month: number) => string;
  markerLabel: string;
}) {
  const id = useId();
  // Drawn at the container's real width so axis text stays legible on phones.
  const wrapper = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const narrow = W < 480;
  const H = narrow ? 220 : 260;
  const pad = { l: narrow ? 44 : 64, r: narrow ? 76 : 96, t: 14, b: 30 };
  const values = series.flatMap((s) => s.values);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const span = rawMax - rawMin || 1;
  const step = niceStep(span / 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step || step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  const x = (m: number) => pad.l + (months === 0 ? 0 : (m / months) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const xTicks = months <= 12 ? Array.from({ length: months + 1 }, (_, i) => i).filter((m) => m % (months > 6 ? 3 : 1) === 0) : Array.from({ length: Math.floor(months / 6) + 1 }, (_, i) => i * 6);

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = svg.current!.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const m = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * months);
    setActive(Math.max(0, Math.min(months, m)));
  }
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((current) => Math.max(0, Math.min(months, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
    }
    if (event.key === "Escape") setActive(null);
  }

  return (
    <figure className="grid gap-3">
      <Legend items={series.map((s, i) => ({ key: s.key, label: s.label, colour: SERIES_COLOURS[i], line: true }))} />
      <div ref={wrapper} className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand"
          role="img"
          aria-label={label}
          aria-describedby={`${id}-desc`}
          tabIndex={0}
          onPointerMove={move}
          onPointerLeave={() => setActive(null)}
          onKeyDown={key}
          onFocus={() => setActive((current) => current ?? months)}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--color-line-strong)" : "var(--color-line-subtle)"} strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--color-fg-subtle)" }}>
                {compact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((m) => (
            <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="11" style={{ fill: "var(--color-fg-subtle)" }}>
              {m}
            </text>
          ))}
          {series.map((s, i) => (
            <g key={s.key}>
              <polyline
                points={s.values.map((v, m) => `${x(m)},${y(v)}`).join(" ")}
                fill="none"
                stroke={SERIES_COLOURS[i]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.marker != null && s.marker <= months && (
                <circle cx={x(s.marker)} cy={y(0)} r={5} fill={SERIES_COLOURS[i]} stroke="var(--color-surface-1)" strokeWidth={2}>
                  <title>{`${s.label}: ${markerLabel}`}</title>
                </circle>
              )}
              <text x={W - pad.r + 8} y={y(s.values[s.values.length - 1]) + 4} fontSize="11" style={{ fill: "var(--color-fg-secondary)" }}>
                {s.label}
              </text>
            </g>
          ))}
          {active !== null && (
            <g aria-hidden="true">
              <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} stroke="var(--color-fg-muted)" strokeWidth={1} />
              {series.map((s, i) => (
                <circle key={s.key} cx={x(active)} cy={y(s.values[active])} r={4} fill={SERIES_COLOURS[i]} stroke="var(--color-surface-1)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {active !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-[var(--radius-md)] border border-line-default bg-surface-2 px-3 py-2 text-xs shadow-lg"
            style={active > months / 2 ? { left: 8 } : { right: 8 }}
            aria-live="polite"
          >
            <p className="font-semibold text-fg">{monthLabel(active)}</p>
            <ul className="mt-1 grid gap-0.5">
              {series.map((s, i) => (
                <li key={s.key} className="flex items-center justify-between gap-3 text-fg-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: SERIES_COLOURS[i] }} />
                    {s.label}
                  </span>
                  <strong className="font-mono text-fg">{format(s.values[active])}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <figcaption id={`${id}-desc`} className="sr-only">
        {series.map((s) => `${s.label}: ${format(s.values[s.values.length - 1])}`).join("; ")}
      </figcaption>
    </figure>
  );
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}

export function compact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${+(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${+(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}${Math.round(abs)}`;
}

// ------------------------------------------------------------------------------------ bar list

/** Single-series horizontal bars (0–100) with the value at the tip; one colour, label in text tokens. */
export function BarList({ items, label, testId }: { items: { key: string; label: string; value: number; note?: string }[]; label: string; testId?: string }) {
  return (
    <figure aria-label={label} data-testid={testId}>
      <ul className="grid gap-2.5">
        {items.map((item) => (
          <li key={item.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 text-sm">
            <span className="truncate text-fg-secondary" title={item.label}>
              {item.label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 rounded-r-[4px]" style={{ width: `calc(${item.value}% - 2.5rem)`, minWidth: item.value > 0 ? 2 : 0, background: SERIES_COLOURS[0] }} aria-hidden="true" />
              <span className="shrink-0 font-mono text-fg">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// -------------------------------------------------------------------------------------- matrix

/**
 * Value (y) against complexity (x), 0–100 each, with quadrant labels. Single series (one colour);
 * each dot carries its rank as a direct label and a hover/focus tooltip; the ranking list beside it
 * holds the same values as text.
 */
export function Matrix({
  points,
  label,
  xLabel,
  yLabel,
  quadrants,
}: {
  points: { key: string; rank: number; name: string; x: number; y: number; detail: string }[];
  label: string;
  xLabel: string;
  yLabel: string;
  quadrants: { topLeft: string; topRight: string; bottomLeft: string; bottomRight: string };
}) {
  const S = 320;
  const pad = 28;
  // Dots use the inner 8–92% so a 0 or 100 never sits on the frame or a quadrant label.
  const inner = (v: number) => 0.08 + (Math.min(100, Math.max(0, v)) / 100) * 0.84;
  const px = (v: number) => pad + inner(v) * (S - 2 * pad);
  const py = (v: number) => S - pad - inner(v) * (S - 2 * pad);
  const edge = (fraction: number) => pad + fraction * (S - 2 * pad);
  const [active, setActive] = useState<string | null>(null);
  const current = points.find((p) => p.key === active);
  return (
    <figure className="relative" aria-label={label}>
      <svg viewBox={`0 0 ${S} ${S}`} className="block h-auto w-full max-w-md" role="group" aria-label={label}>
        <rect x={pad} y={pad} width={S - 2 * pad} height={S - 2 * pad} fill="none" stroke="var(--color-line-default)" strokeWidth={1} />
        <line x1={px(50)} x2={px(50)} y1={pad} y2={S - pad} stroke="var(--color-line-subtle)" strokeWidth={1} />
        <line x1={pad} x2={S - pad} y1={py(50)} y2={py(50)} stroke="var(--color-line-subtle)" strokeWidth={1} />
        {/* The 50-lines are the category thresholds for value and complexity. */}
        {(
          [
            [quadrants.topLeft, edge(0.02), pad + 14, "start"],
            [quadrants.topRight, edge(0.98), pad + 14, "end"],
            [quadrants.bottomLeft, edge(0.02), S - pad - 6, "start"],
            [quadrants.bottomRight, edge(0.98), S - pad - 6, "end"],
          ] as const
        ).map(([text, tx, ty, anchor]) => (
          <text key={text} x={tx} y={ty} textAnchor={anchor} fontSize="10" style={{ fill: "var(--color-fg-subtle)" }}>
            {text}
          </text>
        ))}
        <text x={S / 2} y={S - 6} textAnchor="middle" fontSize="11" style={{ fill: "var(--color-fg-muted)" }}>
          {xLabel}
        </text>
        <text x={10} y={S / 2} textAnchor="middle" fontSize="11" transform={`rotate(-90 10 ${S / 2})`} style={{ fill: "var(--color-fg-muted)" }}>
          {yLabel}
        </text>
        {points.map((p) => (
          <g
            key={p.key}
            tabIndex={0}
            role="img"
            aria-label={`${p.rank}. ${p.name}: ${p.detail}`}
            className="cursor-default outline-none [&:focus-visible>circle]:stroke-[3] [&:focus-visible>circle]:stroke-fg"
            onPointerEnter={() => setActive(p.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(p.key)}
            onBlur={() => setActive(null)}
            data-point={p.key}
          >
            <circle cx={px(p.x)} cy={py(p.y)} r={11} fill={SERIES_COLOURS[0]} stroke="var(--color-surface-1)" strokeWidth={2} />
            <text x={px(p.x)} y={py(p.y) + 4} textAnchor="middle" fontSize="11" fontWeight={700} style={{ fill: "var(--color-surface-page)" }}>
              {p.rank}
            </text>
          </g>
        ))}
      </svg>
      {current && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-60 rounded-[var(--radius-md)] border border-line-default bg-surface-2 px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-fg">
            {current.rank}. {current.name}
          </p>
          <p className="mt-0.5 text-fg-muted">{current.detail}</p>
        </div>
      )}
    </figure>
  );
}
