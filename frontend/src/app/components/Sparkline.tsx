// Thin cyan queue-depth sparkline, no axes.
export function Sparkline({ data, color = "var(--accent-primary)", height = 28 }: { data: number[]; color?: string; height?: number }) {
  const w = 120;
  const max = Math.max(1, ...data);
  const step = w / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Thin teal utilization bar.
export function UtilBar({ pct }: { pct: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: "4px", backgroundColor: "var(--border-default)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, pct)}%`,
          background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
        }}
      />
    </div>
  );
}
