import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "react-router";
import { useSim } from "../store/SimContext";
import { MicroLabel, PriorityChip } from "../components/primitives";
import { StageStepper } from "../components/StageStepper";
import { PulseDot } from "../components/Shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function PatientGuidance() {
  const { state } = useSim();
  const { patients, recommendations } = state;
  const [searchParams, setSearchParams] = useSearchParams();

  const active = useMemo(
    () => patients.filter((p) => p.registered),
    [patients],
  );

  const requestedPatientId = searchParams.get("patient");
  const patient =
    active.find((candidate) => candidate.id === requestedPatientId) ?? active[0];

  useEffect(() => {
    if (patient && requestedPatientId !== patient.id) {
      setSearchParams({ patient: patient.id }, { replace: true });
    }
  }, [patient, requestedPatientId, setSearchParams]);

  const rec = patient ? recommendations[patient.id] : null;

  if (!patient) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <MicroLabel>WAITING FOR ARRIVALS</MicroLabel>
        <p className="mt-4" style={{ color: "var(--text-muted)" }}>The simulated day is just beginning — patients will appear shortly.</p>
      </div>
    );
  }

  const done = patient.currentStage === "done";
  const timeRemaining = rec ? Math.max(0, estimateRemaining(patient, state.minute)) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 items-center">
      {/* Patient selector — demo affordance */}
      <div className="w-full flex justify-center">
        <Select
          value={patient.id}
          onValueChange={(patientId) => setSearchParams({ patient: patientId })}
        >
          <SelectTrigger aria-label="Choose a patient" className="w-[220px] font-mono" style={{ fontSize: "12px", backgroundColor: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {active.map((p) => (
              <SelectItem key={p.id} value={p.id} className="font-mono">{p.token} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Identity */}
      <div className="text-center flex flex-col items-center gap-2">
        <span className="font-sans" style={{ fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent-primary)" }}>{patient.token}</span>
        <span style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 600, color: "var(--text-primary)" }}>{patient.name}</span>
        <PriorityChip priority={patient.priority} />
      </div>

      {done ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "36px", color: "var(--state-success)" }}>✓</div>
          <p className="mt-4" style={{ fontSize: "clamp(16px, 2.4vw, 20px)", color: "var(--text-primary)" }}>
            Your visit is complete. Total time: {(patient.completedAt ?? 0) - patient.arrivalTime} minutes — 25 minutes faster than a typical uncoordinated visit.
          </p>
        </motion.div>
      ) : (
        <div className="w-full flex flex-col gap-6">
          {/* THE CARD */}
          <div className="w-full rounded-2xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 mb-4">
              <PulseDot />
              <MicroLabel>YOUR NEXT STEP</MicroLabel>
            </div>
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={rec?.explanation}
                initial={{ opacity: 0, boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent-primary) 60%, transparent)" }}
                animate={{ opacity: 1, boxShadow: "0 0 0 0px transparent" }}
                transition={{ duration: 0.5 }}
                className="font-sans rounded-md border-l-2 px-5 py-4"
                style={{
                  borderColor: "var(--accent-primary)",
                  backgroundColor: "color-mix(in srgb, var(--accent-primary) 7%, transparent)",
                  color: "var(--text-primary)",
                  fontSize: "clamp(18px, 2.6vw, 22px)",
                  lineHeight: 1.55,
                }}
              >
                {rec?.explanation ?? "Please wait — your next step is being coordinated."}
              </motion.blockquote>
            </AnimatePresence>
          </div>

          {/* Two big stats */}
          <div className="grid grid-cols-2 gap-4">
            <BigStat label="EST. WAIT" value={rec?.etaMin ?? 0} />
            <BigStat label="TIME REMAINING" value={timeRemaining} />
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="w-full overflow-x-auto no-scrollbar py-1">
        <StageStepper patient={patient} />
      </div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <MicroLabel>{label}</MicroLabel>
      <div className="font-sans mt-2" style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
        {value}<span style={{ fontSize: "0.5em", fontWeight: 500, color: "var(--text-muted)" }}> MIN</span>
      </div>
    </div>
  );
}

function estimateRemaining(patient: { requiredServices: { done: boolean; kind: string }[]; estimatedConsultationDuration: number; serviceEndsAt: number | null; currentResourceId: string | null; currentStage: string }, minute: number): number {
  const remaining = patient.requiredServices.filter((s) => !s.done);
  const durMap: Record<string, number> = { lab: 8, xray: 9, ecg: 6, consultation: patient.estimatedConsultationDuration };
  const svcTime = remaining.reduce(
    (sum, service) =>
      sum +
      (patient.currentResourceId && service.kind === patient.currentStage
        ? 0
        : (durMap[service.kind] ?? 5)),
    0,
  );
  const currentRemain = patient.serviceEndsAt != null ? Math.max(0, patient.serviceEndsAt - minute) : 0;
  return svcTime + currentRemain;
}
