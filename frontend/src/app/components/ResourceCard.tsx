import type { Patient, Resource } from "../lib/types";
import { MicroLabel, MonoTag, Panel, StatusChip } from "./primitives";
import { Sparkline, UtilBar } from "./Sparkline";

export function ResourceCard({ resource, patients }: { resource: Resource; patients: Patient[] }) {
  const current = resource.currentPatientId
    ? patients.find((p) => p.id === resource.currentPatientId)
    : null;
  return (
    <Panel hover className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <MonoTag>{resource.tag}</MonoTag>
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
