import { motion } from "motion/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MicroLabel, Panel } from "./primitives";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  // delta vs baseline
  deltaPct?: number; // positive = live higher than baseline
  lowerIsBetter?: boolean;
  footNote?: string; // overrides delta chip (e.g. "12 COMPLETED")
}

export function StatCard({ label, value, unit, deltaPct, lowerIsBetter = true, footNote }: StatCardProps) {
  const improved = deltaPct != null && (lowerIsBetter ? deltaPct < 0 : deltaPct > 0);
  const color = improved ? "var(--state-success)" : "var(--state-error)";
  const magnitude = Math.abs(deltaPct ?? 0);
  return (
    <Panel hover className="flex flex-col gap-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-baseline gap-1.5">
        <motion.span
          key={value}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="font-sans"
          style={{ fontSize: "30px", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--text-primary)" }}
        >
          {value}
        </motion.span>
        {unit && (
          <span className="font-sans" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
      {footNote ? (
        <MicroLabel>{footNote}</MicroLabel>
      ) : deltaPct != null ? (
        <span className="font-sans font-medium inline-flex items-center gap-1" style={{ fontSize: "11px", letterSpacing: "0.04em", color }}>
          {deltaPct < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          {magnitude}% VS UNCOORDINATED
        </span>
      ) : null}
    </Panel>
  );
}
