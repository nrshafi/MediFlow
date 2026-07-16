import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowRight, Search } from "lucide-react";
import { useSim, formatSimTime } from "../store/SimContext";
import type { Patient, Stage } from "../lib/types";
import { MicroLabel, Panel, PriorityChip, QuoteBlock, GuardrailNote, MonoTag } from "../components/primitives";
import { StatCard } from "../components/StatCard";
import { ResourceCard } from "../components/ResourceCard";
import { AlertCard } from "../components/AlertCard";
import { QueueDepthChart, ComparisonChart } from "../components/Charts";
import { StageStepper } from "../components/StageStepper";
import { PulseDot } from "../components/Shell";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const STAGE_BADGE: Record<Stage, string> = {
  registration: "Registration",
  lab: "Laboratory",
  xray: "X-Ray",
  ecg: "ECG",
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  billing: "Billing",
  done: "Done",
};

function pct(live: number, base: number): number {
  if (!base) return 0;
  return Math.round(((live - base) / base) * 100);
}

export function StaffDashboard() {
  const { state } = useSim();
  const { metrics, resources, patients, alerts, recommendations, loading } = state;
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Patient | null>(null);

  const inHouse = useMemo(
    () => patients.filter((p) => p.registered && p.completedAt == null),
    [patients],
  );

  const filtered = useMemo(() => {
    return inHouse.filter((p) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.token.toLowerCase().includes(q);
      const matchStage = stageFilter === "all" || p.currentStage === stageFilter;
      return matchQ && matchStage;
    });
  }, [inHouse, query, stageFilter]);

  if (loading) return <DashboardSkeleton />;

  const selectedRec = selected ? recommendations[selected.id] : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <MicroLabel>01 · LIVE OPERATIONS</MicroLabel>
          <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>
            Hospital Flow — Live
          </h1>
        </div>
        <span className="font-mono uppercase" style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
          RECALCULATED {formatSimTime(state.minute)}
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="AVG WAIT" value={String(metrics.live.avgWaitMin)} unit="MIN" deltaPct={pct(metrics.live.avgWaitMin, metrics.baseline.avgWaitMin)} />
        <StatCard label="AVG VISIT DURATION" value={String(metrics.live.avgVisitMin)} unit="MIN" deltaPct={pct(metrics.live.avgVisitMin, metrics.baseline.avgVisitMin)} />
        <StatCard label="RESOURCE UTILIZATION" value={String(metrics.live.utilizationPct)} unit="%" deltaPct={pct(metrics.live.utilizationPct, metrics.baseline.utilizationPct)} lowerIsBetter={false} />
        <StatCard label="AVG QUEUE DEPTH" value={String(metrics.live.avgQueueDepth)} deltaPct={pct(metrics.live.avgQueueDepth, metrics.baseline.avgQueueDepth)} />
        <StatCard label="PATIENTS IN-HOUSE" value={String(metrics.live.patientsInHouse)} footNote={`${metrics.live.completed} COMPLETED`} />
      </div>

      {/* Main + rail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div>
            <MicroLabel>RESOURCES</MicroLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {resources.map((r) => (
                <ResourceCard key={r.id} resource={r} patients={patients} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottleneck rail */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <PulseDot />
            <MicroLabel>BOTTLENECK DETECTION</MicroLabel>
          </div>
          <div className="flex flex-col gap-3" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {alerts.length === 0 ? (
                <Panel key="empty" className="flex items-center gap-2">
                  <span style={{ color: "var(--state-success)", fontSize: "16px" }}>✓</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>No bottlenecks detected — flow is balanced.</span>
                </Panel>
              ) : (
                alerts.map((a) => <AlertCard key={a.id} alert={a} />)
              )}
            </AnimatePresence>
          </div>
          <GuardrailNote />
        </div>
      </div>

      {/* Patient flow table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <MicroLabel>LIVE PATIENT FLOW</MicroLabel>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                name="patient-search"
                type="search"
                autoComplete="off"
                aria-label="Search patients by name or token"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or token…"
                className="font-mono rounded-md pl-8 pr-3 py-1.5"
                style={{ fontSize: "12px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)", width: 200 }}
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger aria-label="Filter patients by stage" className="w-[160px] font-mono" style={{ fontSize: "12px", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(["registration", "lab", "xray", "ecg", "consultation"] as Stage[]).map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_BADGE[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {["TOKEN", "PATIENT", "PRIORITY", "CURRENT STAGE", "NEXT STEP", "ETA REMAINING", "WAITED"].map((h) => (
                    <th key={h} className="font-mono text-left uppercase px-4 py-3" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const rec = recommendations[p.id];
                  const eta = p.serviceEndsAt != null && p.currentResourceId
                    ? Math.max(0, p.serviceEndsAt - state.minute)
                    : rec?.etaMin ?? 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(p);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`View ${p.name}'s patient flow details`}
                      className="cursor-pointer transition-colors hover:[background-color:var(--bg-raised)]"
                      style={{ borderBottom: "1px solid var(--border-default)" }}
                    >
                      <td className="font-mono px-4 py-3" style={{ fontSize: "12px", color: "var(--accent-primary)" }}>{p.token}</td>
                      <td className="px-4 py-3" style={{ fontSize: "13px", color: "var(--text-primary)" }}>{p.name}</td>
                      <td className="px-4 py-3"><PriorityChip priority={p.priority} /></td>
                      <td className="px-4 py-3">
                        <span className="font-mono rounded-md px-2 py-1" style={{ fontSize: "11px", backgroundColor: "var(--bg-raised)", color: "var(--text-primary)" }}>
                          {STAGE_BADGE[p.currentStage]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--accent-primary)" }} />
                          {rec?.actionText?.replace("Go to ", "") ?? "—"}
                        </span>
                      </td>
                      <td className="font-mono px-4 py-3" style={{ fontSize: "12px", color: "var(--text-primary)" }}>{eta} MIN</td>
                      <td className="font-mono px-4 py-3" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{p.waitedMin} MIN</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      No patients match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueueDepthChart resources={resources} />
        <ComparisonChart metrics={metrics} />
      </div>

      {/* Patient detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "16px" }}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <MonoTag className="!text-[color:var(--accent-primary)]">{selected.token}</MonoTag>
                  <span style={{ fontSize: "18px", color: "var(--text-primary)" }}>{selected.name}</span>
                  <PriorityChip priority={selected.priority} />
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-5 pt-2">
                <div>
                  <MicroLabel>VISIT TIMELINE</MicroLabel>
                  <div className="mt-3 overflow-x-auto pb-2">
                    <StageStepper patient={selected} />
                  </div>
                </div>
                {selectedRec && (
                  <div className="flex flex-col gap-2">
                    <MicroLabel>● CURRENT RECOMMENDATION</MicroLabel>
                    <QuoteBlock>{selectedRec.explanation}</QuoteBlock>
                    <div className="flex gap-6">
                      <span className="font-mono uppercase" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                        ETA <span style={{ color: "var(--text-primary)" }}>{selectedRec.etaMin} MIN</span>
                      </span>
                      <span className="font-mono uppercase" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                        SAVED <span style={{ color: "var(--state-success)" }}>{selectedRec.minutesSaved} MIN</span>
                      </span>
                    </div>
                  </div>
                )}
                <GuardrailNote />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
