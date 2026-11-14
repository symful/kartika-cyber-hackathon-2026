import { useId } from "react";

const TAU = Math.PI * 2;

export type DonutDatum = { label: string; value: number; color: string };

export function Donut({
  data,
  centerValue,
  centerLabel,
  ariaLabel,
}: {
  data: DonutDatum[];
  centerValue?: number;
  centerLabel: string;
  ariaLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 42.5;
  const circumference = TAU * radius;
  const visible = data.filter((d) => d.value > 0);
  const gap = visible.length > 1 ? 2.2 : 0;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 100 100" role="img" aria-label={ariaLabel}>
          <title>{ariaLabel}</title>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--sunk)" strokeWidth="11" />
          {total > 0 &&
            visible.map((d) => {
              const len = (d.value / total) * circumference;
              const dash = Math.max(0, len - gap);
              const element = (
                <circle
                  key={d.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="11"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += len;
              return element;
            })}
        </svg>
        <div className="donut-center">
          <strong>{centerValue ?? total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label} className={d.value === 0 ? "zero" : undefined}>
            <span className="sw" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="num">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type TrendDatum = { label: string; value: number };

export function TrendChart({ data, ariaLabel }: { data: TrendDatum[]; ariaLabel: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = "trend-fill-" + uid;
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 26, t: 14, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const maxValue = Math.max(2, ...data.map((d) => d.value));
  const step = maxValue <= 4 ? 1 : Math.ceil(maxValue / 3);
  const ticks: number[] = [];
  for (let v = 0; v <= maxValue; v += step) ticks.push(v);
  const x = (i: number) => pad.l + (data.length <= 1 ? plotW / 2 : (i * plotW) / (data.length - 1));
  const y = (v: number) => pad.t + plotH * (1 - v / maxValue);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${(pad.t + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(pad.t + plotH).toFixed(1)} Z`;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.015" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--rule)"
            strokeDasharray={tick === 0 ? undefined : "3 4"}
          />
          <text x={pad.l - 8} y={y(tick) + 3.5} textAnchor="end" className="chart-axis">
            {tick}
          </text>
        </g>
      ))}

      {data.length > 0 && (
        <>
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={x(i)} cy={y(d.value)} r="4" fill="#ffffff" stroke="var(--accent)" strokeWidth="2">
                <title>{`${d.label}: ${d.value} laporan`}</title>
              </circle>
              <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">
                {d.label}
              </text>
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

export type HeatmapRow = { key: string; label: string; color: string; bg: string; fg: string; border: string };
export type HeatmapColumn = { key: string; label: string };

export function Heatmap({
  rows,
  columns,
  values,
  ariaLabel,
}: {
  rows: HeatmapRow[];
  columns: HeatmapColumn[];
  values: Record<string, Record<string, number>>;
  ariaLabel: string;
}) {
  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col" aria-label="Severity" />
            {columns.map((c) => (
              <th key={c.key} scope="col">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <span className="cell-dot" style={{ background: row.color }} />
                {row.label}
              </th>
              {columns.map((col) => {
                const value = values[row.key]?.[col.key] ?? 0;
                return (
                  <td
                    key={col.key}
                    className={value > 0 ? "nonzero" : undefined}
                    style={value > 0 ? { background: row.bg, color: row.fg, borderColor: row.border } : undefined}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
