"use client";

import { useState } from "react";

/**
 * Minimal single-series bar chart (SVG). One hue (navy), recessive grid,
 * rounded data-ends anchored to the baseline, per-bar hover tooltip, and an
 * accessible table fallback.
 */
export function BarChart({ title, data, unit = "" }: { title: string; data: { label: string; value: number }[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = 180;
  const pad = { t: 12, r: 8, b: 26, l: 34 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / data.length;
  const bw = Math.max(4, Math.min(28, step - 2));
  const ticks = [0, nice / 2, nice];
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const r = 4;

  return (
    <figure className="card p-5">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs tabular-nums text-charcoal-500">
          {hover !== null ? `${data[hover].label}: ${data[hover].value.toLocaleString()}${unit}` : `Latest: ${data.at(-1)?.value.toLocaleString() ?? 0}${unit}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tv)} y2={y(tv)} className="stroke-charcoal-200 dark:stroke-charcoal-800" strokeWidth={1} />
            <text x={pad.l - 6} y={y(tv) + 3} textAnchor="end" className="fill-charcoal-500 text-[10px]">{tv}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * step + (step - bw) / 2;
          const top = y(d.value);
          const h = pad.t + ih - top;
          const rr = Math.min(r, h, bw / 2);
          const path = h <= 0 ? "" : `M${x},${pad.t + ih} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + bw - rr} Q${x + bw},${top} ${x + bw},${top + rr} V${pad.t + ih} Z`;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${d.value}`}>
              <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" />
              {path && <path d={path} className={hover === null || hover === i ? "fill-navy-600 dark:fill-navy-400" : "fill-navy-300 dark:fill-navy-700"} />}
              {(i === 0 || i === data.length - 1 || (data.length <= 10 && i % 2 === 0)) && (
                <text x={pad.l + i * step + step / 2} y={H - 8} textAnchor="middle" className="fill-charcoal-500 text-[10px]">{d.label}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} className="stroke-charcoal-300 dark:stroke-charcoal-700" strokeWidth={1} />
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th>{d.label}</th><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
