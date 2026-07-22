import { Stethoscope, FlaskConical, Scan, Activity } from "lucide-react";
import type { Patient, Resource } from "../lib/types";
import { MicroLabel, MonoTag, Panel, StatusChip } from "./primitives";
import { Sparkline, UtilBar } from "./Sparkline";

const RESOURCE_ICON_MAP = {
  doctor: Stethoscope,
  lab: FlaskConical,
  xray: Scan,
  ecg: Activity,
} as const;

export function ResourceCard({ resource, patients }: { resource: Resource; patients: Patient[] }) {
  const current = resource.currentPatientId
    ? patients.find((p) => p.id === resource.currentPatientId)
    : null;
  const Icon = RESOURCE_ICON_MAP[resource.type] || Activity;
  const categoryLabel = resource.type === "doctor" ? "DOCTOR" : "DIAGNOSTIC";

  return (
    <Panel hover className="flex flex-col gap-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <MonoTag>{resource.tag}</MonoTag>
          <span
            className="font-mono inline-flex items-center gap-1 rounded-full border px-2 py-[2px] uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: "0.08em",
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
              backgroundColor: "var(--bg-raised)",
            }}
          >
            <Icon className="h-3 w-3" style={{ color: "var(--accent-primary)" }} />
            {categoryLabel}
          </span>
        </div>
        <StatusChip status={resource.status} />
      </div>
      <div>
        <div style={{ fontSize: "16px", color: "var(--text-primary)" }}>{resource.name}</div>
        {resource.specialty && (
          <div className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {resource.specialty}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <MicroLabel>NOW</MicroLabel>
          <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            {current ? `${current.name} · ${current.token}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <MicroLabel>QUEUE</MicroLabel>
          <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-primary)" }}>
            {resource.queue.length}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <MicroLabel>EST WAIT {resource.predictedWaitMin} MIN</MicroLabel>
        <MicroLabel>{resource.utilizationPct}% UTIL</MicroLabel>
      </div>
      <Sparkline data={resource.queueHistory} />
      <UtilBar pct={resource.utilizationPct} />
    </Panel>
  );
}

