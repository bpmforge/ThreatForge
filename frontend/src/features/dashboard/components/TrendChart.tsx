"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendDataPoint } from "../hooks/usePortfolioDashboard";

interface Series {
  label: string;
  color: string;
  data: TrendDataPoint[];
}

interface Props {
  title: string;
  series: Series[];
  height?: number;
}

export function TrendChart({ title, series, height = 120 }: Props) {
  // Merge all dates from all series
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.date))),
  ).sort();

  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const maxVal = Math.max(...allValues, 1);

  if (allDates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No trend data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const w = 600;
  const padX = 8;
  const padY = 8;
  const chartW = w - padX * 2;
  const chartH = height - padY * 2;

  const xPos = (i: number) =>
    padX +
    (allDates.length > 1 ? (i / (allDates.length - 1)) * chartW : chartW / 2);
  const yPos = (v: number) => padY + chartH - (v / maxVal) * chartH;

  const polyline = (data: TrendDataPoint[]) => {
    const byDate = new Map(data.map((d) => [d.date, d.value]));
    return allDates
      .map((d, i) => `${xPos(i)},${yPos(byDate.get(d) ?? 0)}`)
      .join(" ");
  };

  // Show only first, middle, last labels
  const labelIndices = new Set([
    0,
    Math.floor((allDates.length - 1) / 2),
    allDates.length - 1,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${w} ${height + 20}`}
          className="w-full"
          aria-label={title}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padX}
              y1={padY + chartH * (1 - f)}
              x2={w - padX}
              y2={padY + chartH * (1 - f)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}
          {/* Series polylines */}
          {series.map((s) => (
            <polyline
              key={s.label}
              points={polyline(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* X-axis date labels */}
          {allDates.map((d, i) =>
            labelIndices.has(i) ? (
              <text
                key={d}
                x={xPos(i)}
                y={height + 16}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.5}
              >
                {d.slice(5)}
              </text>
            ) : null,
          )}
        </svg>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-1">
          {series.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <svg width={16} height={4}>
                <line
                  x1={0}
                  y1={2}
                  x2={16}
                  y2={2}
                  stroke={s.color}
                  strokeWidth={2}
                />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
