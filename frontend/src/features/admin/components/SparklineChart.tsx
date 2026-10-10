"use client";

interface SparklineChartProps {
  data: number[];
  max?: number;
  color?: string;
  label: string;
}

export function SparklineChart({
  data,
  max,
  color = "currentColor",
  label,
}: SparklineChartProps) {
  if (data.length < 2) return null;
  const effectiveMax = max ?? Math.max(...data, 1);
  const w = 120;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / effectiveMax) * h;
    return `${x},${y}`;
  });
  return (
    <svg
      width={w}
      height={h}
      className="inline-block"
      aria-label={`${label} trend`}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
