import { Check } from "lucide-react";
import type { Patient, Stage } from "../lib/types";

const STAGE_LABEL: Record<Stage, string> = {
  registration: "Registration",
  lab: "Blood Test",
  xray: "X-Ray",
  ecg: "ECG",
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  billing: "Billing",
  done: "Complete",
};

type StepState = "done" | "current" | "upcoming";

function buildSteps(patient: Patient): Array<{ stage: Stage; label: string; state: StepState }> {
  const stages: Stage[] = ["registration"];
  const append = (stage: Stage) => {
    if (stage !== "done" && !stages.includes(stage)) stages.push(stage);
  };
  patient.timeline.forEach((entry) => append(entry.stage));
  append(patient.currentStage);
  patient.requiredServices
    .filter((service) => !service.done)
    .forEach((service) => append(service.kind));
  return stages.map((stage) => {
    const tl = patient.timeline.find((t) => t.stage === stage);
    let state: StepState = "upcoming";
    if (patient.currentStage === "done") state = "done";
    else if (stage === patient.currentStage) state = "current";
    else if (tl && tl.end != null) state = "done";
    else state = "upcoming";
    const label = stage === "consultation"
      ? `Consultation — ${doctorNameFor(patient)}`
      : STAGE_LABEL[stage];
    return { stage, label, state };
  });
}

function doctorNameFor(patient: Patient): string {
  const consult = patient.requiredServices.find((s) => s.kind === "consultation");
  const id = consult?.doctorId;
  if (id === "dr-rahman") return "Dr. Rahman";
  if (id === "dr-akter") return "Dr. Akter";
  if (id === "dr-chowdhury") return "Dr. Chowdhury";
  return "Doctor";
}

export function StageStepper({ patient, orientation = "horizontal" }: { patient: Patient; orientation?: "horizontal" | "vertical" }) {
  const steps = buildSteps(patient);
  const vertical = orientation === "vertical";
  return (
    <div className={vertical ? "flex flex-col gap-0 py-2 px-3.5" : "flex items-start justify-between gap-1 w-full px-5 sm:px-6 pt-4 pb-2"}>
      {steps.map((step, i) => (
        <div key={step.stage} className={vertical ? "flex gap-3" : "flex flex-col items-center flex-1 min-w-0"}>
          <div className={vertical ? "flex flex-col items-center" : "flex items-center w-full"}>
            {!vertical && i > 0 && (
              <div
                className="flex-1 h-[2px]"
                style={{ backgroundColor: step.state === "upcoming" ? "var(--border-default)" : "var(--accent-secondary)" }}
              />
            )}
            <Circle state={step.state} n={i + 1} />
            {!vertical && i < steps.length - 1 && (
              <div
                className="flex-1 h-[2px]"
                style={{ backgroundColor: steps[i + 1].state === "upcoming" ? "var(--border-default)" : "var(--accent-secondary)" }}
              />
            )}
            {vertical && i < steps.length - 1 && (
              <div className="w-[2px] flex-1 my-1" style={{ minHeight: "18px", backgroundColor: step.state === "done" ? "var(--accent-secondary)" : "var(--border-default)" }} />
            )}
          </div>
          <span
            className={`font-mono text-center ${vertical ? "pt-1 pb-3" : "mt-2"} truncate max-w-full`}
            style={{ fontSize: "10px", letterSpacing: "0.06em", color: step.state === "upcoming" ? "var(--text-muted)" : "var(--text-primary)" }}
            title={step.label}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Circle({ state, n }: { state: StepState; n: number }) {
  if (state === "done") {
    return (
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 28, height: 28, background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" }}
      >
        <Check className="h-4 w-4" style={{ color: "var(--bg-base)" }} strokeWidth={3} />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: 28, height: 28 }}>
        <span className="absolute inset-0 rounded-full animate-ping pointer-events-none" style={{ backgroundColor: "color-mix(in srgb, var(--accent-primary) 40%, transparent)" }} />
        <div
          className="relative flex items-center justify-center rounded-full font-mono"
          style={{ width: 28, height: 28, border: "2px solid var(--accent-primary)", color: "var(--accent-primary)", fontSize: "11px", backgroundColor: "var(--bg-surface)" }}
        >
          {n}
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full font-mono shrink-0"
      style={{ width: 28, height: 28, border: "1.5px solid var(--border-default)", color: "var(--text-muted)", fontSize: "11px" }}
    >
      {n}
    </div>
  );
}
