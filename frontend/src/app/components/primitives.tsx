import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { Priority, ResourceStatus } from "../lib/types";

// ── MonoTag — tiny bordered uppercase pill (e.g. "F1", "LAB") ──
export function MonoTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-sans font-semibold inline-flex items-center rounded-full border px-2 py-[2px] uppercase ${className}`}
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        borderColor: "var(--border-default)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </span>
  );
}

// ── MicroLabel — uppercase mono caption ──
export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-sans font-semibold uppercase ${className}`}
      style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)" }}
    >
      {children}
    </span>
  );
}

const STATUS_MAP: Record<ResourceStatus, { label: string; color: string }> = {
  available: { label: "AVAILABLE", color: "var(--state-success)" },
  busy: { label: "BUSY", color: "var(--state-error)" },
  congested: { label: "CONGESTED", color: "var(--state-warning)" },
};

// ── StatusChip — text always present, never color alone ──
export function StatusChip({ status }: { status: ResourceStatus }) {
  const s = STATUS_MAP[status];
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="font-sans font-semibold inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 uppercase"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: s.color,
        backgroundColor: `color-mix(in srgb, ${s.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 40%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </motion.span>
  );
}

// ── PriorityChip ──
export function PriorityChip({ priority }: { priority: Priority }) {
  if (priority === "urgent") {
    return (
      <span
        className="font-sans font-semibold inline-flex items-center rounded-full px-2 py-[2px] uppercase"
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "var(--state-error)",
          border: "1px solid var(--state-error)",
        }}
      >
        URGENT
      </span>
    );
  }
  return (
    <span
      className="font-sans font-semibold inline-flex items-center rounded-full px-2 py-[2px] uppercase"
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        border: "1px solid var(--border-default)",
      }}
    >
      NORMAL
    </span>
  );
}

// ── Card shell (surface + border + hover to raised) ──
export function Panel({
  children,
  className = "",
  hover = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors duration-200 ${hover ? "hover:[background-color:var(--bg-raised)]" : ""} ${className}`}
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-default)", ...style }}
    >
      {children}
    </div>
  );
}

// ── QuoteBlock — AI plain-language explanation ──
export function QuoteBlock({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return (
    <blockquote
      className="font-sans rounded-md border-l-2 px-4 py-3"
      style={{
        borderColor: "var(--accent-primary)",
        backgroundColor: "color-mix(in srgb, var(--accent-primary) 7%, transparent)",
        color: "var(--text-primary)",
        fontSize: large ? "clamp(18px, 2.4vw, 22px)" : "13px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </blockquote>
  );
}


// ── DataFooter — persistent simulated-data disclaimer ──
export function DataFooter() {
  return (
    <div
      className="font-sans uppercase text-center py-3"
      style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", color: "var(--text-muted)" }}
    >
      SIMULATED DATA — NO REAL PATIENT RECORDS
    </div>
  );
}

// ── PassGlyph / FailGlyph ──
export function PassGlyph({ className = "" }: { className?: string }) {
  return <Check className={className} style={{ color: "var(--state-success)" }} strokeWidth={2.5} />;
}
