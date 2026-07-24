import { Check, FlaskConical, Stethoscope, Scan, Activity, Pill, CreditCard } from "lucide-react";
import type { Patient, Priority, Stage } from "../lib/types";

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
    const label = STAGE_LABEL[stage] ?? stage;
    return { stage, label, state };
  });
}

function StageIcon({ stage, className = "", style }: { stage: Stage; className?: string; style?: React.CSSProperties }) {
  switch (stage) {
    case "registration":
      return <Check className={className} style={style} />;
    case "lab":
      return <FlaskConical className={className} style={style} />;
    case "consultation":
      return <Stethoscope className={className} style={style} />;
    case "xray":
      return <Scan className={className} style={style} />;
    case "ecg":
      return <Activity className={className} style={style} />;
    case "pharmacy":
      return <Pill className={className} style={style} />;
    case "billing":
      return <CreditCard className={className} style={style} />;
    default:
      return <Check className={className} style={style} />;
  }
}

export function StageStepper({
  patient,
  orientation = "horizontal",
}: {
  patient: Patient;
  orientation?: "horizontal" | "vertical";
}) {
  const steps = buildSteps(patient);
  const vertical = orientation === "vertical";
  const priority = patient.priority;
  const isUrgent = priority === "urgent";
  const activeColor = isUrgent ? "var(--state-error)" : "var(--accent-primary)";

  if (vertical) {
    return (
      <div className="flex flex-col gap-0 py-2 px-3.5">
        {steps.map((step, i) => (
          <div key={step.stage} className="flex flex-col">
            <div className="flex gap-3 items-center">
              <Circle state={step.state} stage={step.stage} priority={priority} />
              <span
                className="font-sans text-xs"
                style={{
                  fontWeight: step.state === "current" ? 700 : step.state === "done" ? 600 : 500,
                  color:
                    step.state === "current"
                      ? activeColor
                      : step.state === "done"
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-[2px] ml-[17px] my-1"
                style={{
                  minHeight: "20px",
                  backgroundColor:
                    steps[i + 1].state === "done" || steps[i + 1].state === "current"
                      ? activeColor
                      : "var(--border-default)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between w-full px-2 sm:px-4 pt-3 pb-2">
      {steps.map((step, i) => {
        const isReached = step.state === "done" || step.state === "current";
        return (
          <div key={step.stage} className="flex items-start flex-1 last:flex-none min-w-0">
            <div className="flex flex-col items-center shrink-0 min-w-0 px-1" style={{ maxWidth: "100px" }}>
              <div className="flex items-center justify-center shrink-0" style={{ height: 36 }}>
                <Circle state={step.state} stage={step.stage} priority={priority} />
              </div>
              <span
                className="font-sans text-center mt-2.5 truncate max-w-full"
                style={{
                  fontSize: "11px",
                  fontWeight: step.state === "current" ? 700 : step.state === "done" ? 600 : 500,
                  color:
                    step.state === "current"
                      ? activeColor
                      : step.state === "done"
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                }}
                title={step.label}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-[2px] mt-[17px] min-w-[16px]"
                style={{
                  backgroundColor:
                    steps[i + 1].state === "done" || steps[i + 1].state === "current"
                      ? activeColor
                      : "var(--border-default)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Circle({ state, stage, priority }: { state: StepState; stage: Stage; priority: Priority }) {
  if (state === "done") {
    return (
      <div
        className="flex items-center justify-center rounded-full shrink-0 shadow-xs"
        style={{
          width: 36,
          height: 36,
          backgroundColor: "var(--accent-primary)",
        }}
      >
        <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
    );
  }

  if (state === "current") {
    const isUrgent = priority === "urgent";
    const primaryColor = isUrgent ? "var(--state-error)" : "var(--accent-primary)";
    const bgMix = isUrgent
      ? "color-mix(in srgb, var(--state-error) 10%, white)"
      : "color-mix(in srgb, var(--accent-primary) 10%, white)";

    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: 36, height: 36 }}>
        <span
          className="absolute -inset-1 rounded-full animate-ping pointer-events-none"
          style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 25%, transparent)` }}
        />
        <div
          className="relative flex items-center justify-center rounded-full shadow-xs transition-all"
          style={{
            width: 36,
            height: 36,
            border: `2px solid ${primaryColor}`,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${primaryColor} 20%, transparent)`,
            backgroundColor: bgMix,
          }}
        >
          <StageIcon stage={stage} className="h-4.5 w-4.5" style={{ color: primaryColor }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 36,
        height: 36,
        border: "1.5px solid var(--border-default)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <StageIcon stage={stage} className="h-4 w-4" style={{ color: "var(--text-muted)", opacity: 0.6 }} />
    </div>
  );
}

