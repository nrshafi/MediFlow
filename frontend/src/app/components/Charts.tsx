import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrics, Resource } from "../lib/types";
import { MicroLabel, Panel } from "./primitives";

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

const axisTick = { fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--text-muted)" };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="font-mono rounded-md px-3 py-2"
      style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-default)", fontSize: "11px" }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: p.color }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function QueueDepthChart({ resources }: { resources: Resource[] }) {
  const len = resources[0]?.queueHistory.length ?? 30;
  const data = Array.from({ length: len }, (_, i) => {
    const row: Record<string, number | string> = { t: `-${len - i}m` };
    resources.forEach((r) => {
      row[r.name] = r.queueHistory[i] ?? 0;
    });
    return row;
  });
  return (
    <Panel className="flex flex-col gap-3">
      <MicroLabel>QUEUE DEPTH — LAST 60 MIN</MicroLabel>
      <div className="flex flex-wrap gap-2">
        {resources.map((r, i) => (
          <span key={r.id} className="font-mono inline-flex items-center gap-1.5 rounded-full px-2 py-[2px]" style={{ fontSize: "10px", letterSpacing: "0.06em", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: SERIES_COLORS[i % 6] }} />
            {r.name}
          </span>
        ))}
      </div>
      <div style={{ height: 220 }} role="img" aria-label="Queue depth per resource over the last 60 minutes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="t" tick={axisTick} interval={5} axisLine={{ stroke: "var(--border-default)" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={{ stroke: "var(--border-default)" }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            {resources.map((r, i) => (
              <Line key={r.id} type="monotone" dataKey={r.name} stroke={SERIES_COLORS[i % 6]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function ComparisonChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { metric: "Avg Wait", Uncoordinated: metrics.baseline.avgWaitMin, MediFlow: metrics.live.avgWaitMin },
    { metric: "Avg Visit", Uncoordinated: metrics.baseline.avgVisitMin, MediFlow: metrics.live.avgVisitMin },
    { metric: "Avg Queue", Uncoordinated: metrics.baseline.avgQueueDepth, MediFlow: metrics.live.avgQueueDepth },
  ];
  return (
    <Panel className="flex flex-col gap-3">
      <MicroLabel>MEDIFLOW VS UNCOORDINATED</MicroLabel>
      <div className="flex flex-wrap gap-2">
        <LegendChip color="var(--series-5)" label="Uncoordinated" />
        <LegendChip color="var(--accent-primary)" label="MediFlow" />
      </div>
      <div style={{ height: 220 }} role="img" aria-label="MediFlow versus uncoordinated average wait and visit duration">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="metric" tick={axisTick} axisLine={{ stroke: "var(--border-default)" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={{ stroke: "var(--border-default)" }} tickLine={false} unit="m" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "color-mix(in srgb, var(--accent-primary) 6%, transparent)" }} />
            <Bar dataKey="Uncoordinated" fill="var(--series-5)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="MediFlow" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="font-mono inline-flex items-center gap-1.5 rounded-full px-2 py-[2px]" style={{ fontSize: "10px", letterSpacing: "0.06em", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}>
      <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: color }} />
      {label}
    </span>
  );
}
