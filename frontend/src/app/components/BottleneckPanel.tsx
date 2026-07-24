import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, CheckCircle2, History, AlertTriangle, Check, Layers } from "lucide-react";
import type { BottleneckAlert, Resource } from "../lib/types";
import { formatSimClock, useSim } from "../store/SimContext";
import { MicroLabel, Panel } from "./primitives";
import { AlertCard } from "./AlertCard";

export interface BottleneckHistoryEvent {
  id: string;
  minute: number;
  timeFormatted: string;
  type: "baseline" | "warning" | "critical" | "resolved";
  title: string;
  description: string;
  resourceName?: string;
}

export function BottleneckPanel() {
  const { state } = useSim();
  const { alerts, resources, minute } = state;

  // Calculate live load metrics across resources
  const highestResource = useMemo(() => {
    if (!resources || resources.length === 0) return null;
    return resources.reduce((max, r) => (r.utilizationPct > max.utilizationPct ? r : max), resources[0]);
  }, [resources]);

  const lowestResource = useMemo(() => {
    if (!resources || resources.length === 0) return null;
    return resources.reduce((min, r) => (r.utilizationPct < min.utilizationPct ? r : min), resources[0]);
  }, [resources]);

  const diagnosticsAvgPct = useMemo(() => {
    if (!resources || resources.length === 0) return 0;
    const diag = resources.filter((r) => r.type !== "doctor");
    if (diag.length === 0) return 0;
    const sum = diag.reduce((acc, r) => acc + r.utilizationPct, 0);
    return Math.round(sum / diag.length);
  }, [resources]);

  // Bottleneck history state
  const [historyEvents, setHistoryEvents] = useState<BottleneckHistoryEvent[]>([
    {
      id: "init-0",
      minute: 0,
      timeFormatted: "09:00 AM",
      type: "baseline",
      title: "Flow Balanced",
      description: "Simulation initialized — flow is balanced across all resources.",
    },
  ]);

  const prevMinuteRef = useRef(minute);
  const prevAlertCountRef = useRef(alerts.length);
  const loggedAlertIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Reset history when minute resets to 0
    if (minute === 0 && prevMinuteRef.current > 0) {
      setHistoryEvents([
        {
          id: "init-0",
          minute: 0,
          timeFormatted: "09:00 AM",
          type: "baseline",
          title: "Flow Balanced",
          description: "Simulation initialized — flow is balanced across all resources.",
        },
      ]);
      loggedAlertIdsRef.current.clear();
      prevMinuteRef.current = 0;
      prevAlertCountRef.current = alerts.length;
      return;
    }

    const timeFormatted = formatSimClock(minute);

    // Track new alerts
    if (alerts.length > 0) {
      const newEvents: BottleneckHistoryEvent[] = [];
      alerts.forEach((alert) => {
        if (!loggedAlertIdsRef.current.has(alert.id)) {
          loggedAlertIdsRef.current.add(alert.id);
          const res = resources.find((r) => r.id === alert.resourceId);
          newEvents.push({
            id: alert.id,
            minute,
            timeFormatted,
            type: alert.severity === "critical" ? "critical" : "warning",
            title: `${res?.name || "Resource"} Congestion Alert`,
            description: alert.headline,
            resourceName: res?.name,
          });
        }
      });

      if (newEvents.length > 0) {
        setHistoryEvents((prev) => [...newEvents, ...prev]);
      }
    }

    // Track resolution when alerts clear
    if (prevAlertCountRef.current > 0 && alerts.length === 0 && minute > prevMinuteRef.current) {
      const resolveId = `resolve-${minute}`;
      if (!loggedAlertIdsRef.current.has(resolveId)) {
        loggedAlertIdsRef.current.add(resolveId);
        setHistoryEvents((prev) => [
          {
            id: resolveId,
            minute,
            timeFormatted,
            type: "resolved",
            title: "Bottleneck Resolved",
            description: "Flow is balanced across all resources.",
          },
          ...prev,
        ]);
      }
    }

    prevMinuteRef.current = minute;
    prevAlertCountRef.current = alerts.length;
  }, [minute, alerts, resources]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── BOTTLENECK DETECTION CARD ── */}
      <Panel className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex" style={{ width: 7, height: 7 }}>
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "var(--accent-primary)", opacity: 0.6 }}
              />
              <span
                className="relative rounded-full"
                style={{ width: 7, height: 7, backgroundColor: "var(--accent-primary)" }}
              />
            </span>
            <MicroLabel>BOTTLENECK DETECTION</MicroLabel>
          </div>
          {alerts.length > 0 ? (
            <span
              className="font-sans font-semibold rounded-full px-2 py-0.5 uppercase"
              style={{
                fontSize: "10px",
                backgroundColor: "color-mix(in srgb, var(--state-warning) 15%, transparent)",
                color: "var(--state-warning)",
                border: "1px solid color-mix(in srgb, var(--state-warning) 40%, transparent)",
              }}
            >
              {alerts.length} {alerts.length === 1 ? "ALERT" : "ALERTS"}
            </span>
          ) : (
            <span
              className="font-sans font-semibold rounded-full px-2 py-0.5 uppercase"
              style={{
                fontSize: "10px",
                backgroundColor: "color-mix(in srgb, var(--state-success) 12%, transparent)",
                color: "var(--state-success)",
                border: "1px solid color-mix(in srgb, var(--state-success) 40%, transparent)",
              }}
            >
              BALANCED
            </span>
          )}
        </div>

        {/* Live Bottleneck Banner / Alert List */}
        <div aria-live="polite" className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {alerts.length === 0 ? (
              <motion.div
                key="balanced-status"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border p-4 sm:p-5 flex items-center gap-2.5 transition-colors duration-200"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--state-success) 6%, var(--bg-surface))",
                  borderColor: "color-mix(in srgb, var(--state-success) 25%, var(--border-default))",
                }}
              >
                <CheckCircle2
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--state-success)" }}
                  strokeWidth={2.2}
                />
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
                  No bottlenecks detected — flow is balanced across all resources.
                </span>
              </motion.div>
            ) : (
              alerts.map((a) => <AlertCard key={a.id} alert={a} />)
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Resource Load Breakdown */}
        <div
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: "var(--border-default)" }}>
            <span
              className="font-sans font-semibold uppercase"
              style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-muted)" }}
            >
              RESOURCE LOAD BREAKDOWN
            </span>
            <span
              className="font-sans"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}
            >
              LIVE UTILIZATION
            </span>
          </div>

          {/* Highest load */}
          <ResourceLoadRow
            label={`Highest load — ${highestResource?.name || "Dr. Akter"}`}
            pct={highestResource?.utilizationPct ?? 0}
            barColor={
              (highestResource?.utilizationPct ?? 0) >= 70
                ? "var(--state-warning)"
                : "var(--accent-primary)"
            }
          />

          {/* Diagnostics average */}
          <ResourceLoadRow
            label="Diagnostics average"
            pct={diagnosticsAvgPct}
            barColor="var(--accent-secondary)"
          />

          {/* Lowest load */}
          <ResourceLoadRow
            label={`Lowest load — ${lowestResource?.name || "ECG"}`}
            pct={lowestResource?.utilizationPct ?? 0}
            barColor="var(--accent-primary)"
          />
        </div>
      </Panel>

      {/* ── BOTTLENECK HISTORY CARD ── */}
      <Panel className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" style={{ color: "var(--accent-primary)" }} />
            <MicroLabel>BOTTLENECK HISTORY</MicroLabel>
          </div>
          <span
            className="font-sans font-semibold rounded-full px-2 py-0.5 uppercase"
            style={{
              fontSize: "10px",
              backgroundColor: "var(--bg-raised)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-default)",
            }}
          >
            {historyEvents.length} {historyEvents.length === 1 ? "EVENT" : "EVENTS"}
          </span>
        </div>

        {/* Timeline Log */}
        <div className="flex flex-col max-h-[340px] overflow-y-auto pl-3.5 pr-1 no-scrollbar gap-2.5">
          <AnimatePresence initial={false}>
            {historyEvents.map((evt, idx) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="relative pl-5 pb-3 border-l text-left transition-colors"
                style={{
                  borderColor:
                    idx === historyEvents.length - 1 ? "transparent" : "var(--border-default)",
                }}
              >
                {/* Timeline node icon / dot */}
                <div
                  className="absolute -left-[7.5px] top-0.5 rounded-full flex items-center justify-center p-[2px]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: `1.5px solid ${getEventColor(evt.type)}`,
                  }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getEventColor(evt.type) }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-sans font-semibold"
                    style={{ fontSize: "12px", color: "var(--text-primary)" }}
                  >
                    {evt.title}
                  </span>
                  <span
                    className="font-mono rounded-md px-1.5 py-0.5 shrink-0 uppercase"
                    style={{
                      fontSize: "10px",
                      backgroundColor: "var(--bg-raised)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {evt.timeFormatted}
                  </span>
                </div>

                <p
                  className="mt-1"
                  style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}
                >
                  {evt.description}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Panel>
    </div>
  );
}

function ResourceLoadRow({
  label,
  pct,
  barColor,
}: {
  label: string;
  pct: number;
  barColor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Visual mini load bar */}
        <div
          className="relative rounded-full shrink-0 overflow-hidden"
          style={{ width: 28, height: 5, backgroundColor: "var(--bg-raised)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: barColor }}
          />
        </div>

        <span
          className="truncate"
          style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 400 }}
        >
          {label}
        </span>
      </div>

      <span
        className="font-sans font-semibold shrink-0"
        style={{ fontSize: "13px", color: "var(--text-primary)" }}
      >
        {pct}%
      </span>
    </div>
  );
}

function getEventColor(type: BottleneckHistoryEvent["type"]): string {
  switch (type) {
    case "critical":
      return "var(--state-error)";
    case "warning":
      return "var(--state-warning)";
    case "resolved":
    case "baseline":
    default:
      return "var(--state-success)";
  }
}
