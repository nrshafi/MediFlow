import { motion } from "motion/react";
import type { BottleneckAlert } from "../lib/types";
import { formatSimClock } from "../store/SimContext";

export function AlertCard({ alert }: { alert: BottleneckAlert }) {
  const color = alert.severity === "critical" ? "var(--state-error)" : "var(--state-warning)";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl p-4"
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid var(--border-default)`,
        borderLeftWidth: "3px",
        borderLeftColor: color,
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>{alert.headline}</div>
      <div className="mt-1.5" style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
        {alert.suggestedAction}
      </div>
      <div className="font-sans font-medium mt-2 uppercase" style={{ fontSize: "10px", letterSpacing: "0.06em", color }}>
        {alert.severity} · DETECTED {formatSimClock(alert.detectedAt)}
      </div>
    </motion.div>
  );
}
