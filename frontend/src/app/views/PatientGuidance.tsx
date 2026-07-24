import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "react-router";
import { Clock } from "lucide-react";
import { useSim } from "../store/SimContext";
import { StageStepper } from "../components/StageStepper";
import type { Patient } from "../lib/types";
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
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">WAITING FOR ARRIVALS</span>
        <p className="mt-4 text-slate-500">The simulated day is just beginning — patients will appear shortly.</p>
      </div>
    );
  }

  const done = patient.currentStage === "done";
  const isUrgent = patient.priority === "urgent";
  const timeRemaining = rec ? Math.max(0, estimateRemaining(patient, state.minute)) : 0;
  const progressPercentage = getVisitProgressPercentage(patient);
  const expectation = getExpectation(patient);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 items-center">
      {/* Patient dropdown pill */}
      <div className="w-full flex justify-center">
        <Select
          value={patient.id}
          onValueChange={(patientId) => setSearchParams({ patient: patientId })}
        >
          <SelectTrigger
            aria-label="Choose a patient"
            className="w-[240px] font-sans font-medium rounded-full shadow-xs border-slate-200 bg-white text-slate-700 text-xs py-1.5 h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {active.map((p) => (
              <SelectItem key={p.id} value={p.id} className="font-sans text-xs">
                {p.token} · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Patient Header Identity */}
      <div className="text-center flex flex-col items-center gap-1">
        <h1 className="font-sans font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight">
          {patient.name}
        </h1>
        <span className="font-sans text-xs font-semibold text-slate-400 tracking-wider uppercase">
          {patient.token}
        </span>
        <div className="mt-1">
          {isUrgent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase bg-rose-50 border border-rose-200/80 text-rose-600">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 inline-block animate-pulse" />
              URGENT
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase bg-slate-100 border border-slate-200/80 text-slate-500">
              NORMAL
            </span>
          )}
        </div>
      </div>

      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl p-8 text-center bg-white border border-slate-200/80 shadow-sm"
        >
          <div className="text-4xl text-emerald-600 font-bold mb-3">✓</div>
          <h2 className="font-sans text-xl font-bold text-slate-900">Visit Complete</h2>
          <p className="mt-2 text-slate-600 text-sm leading-relaxed">
            Your visit is complete. Total duration: {(patient.completedAt ?? 0) - patient.arrivalTime} minutes — approximately 25 minutes faster than an uncoordinated visit.
          </p>
        </motion.div>
      ) : (
        <div className="w-full flex flex-col gap-5">
          {/* Card 1: YOUR NEXT STEP / PRIORITY — NEXT STEP */}
          <div className="w-full rounded-2xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {isUrgent ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600">
                  <span className="h-2 w-2 rounded-full bg-rose-600 inline-block" />
                  PRIORITY — NEXT STEP
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-700">
                  <span className="h-2 w-2 rounded-full bg-cyan-600 inline-block" />
                  YOUR NEXT STEP
                </span>
              )}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={rec?.explanation}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="font-sans text-xl sm:text-2xl font-bold text-slate-900 leading-snug"
              >
                {rec?.explanation ?? "Your next step is being coordinated."}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Card 2: EST. WAIT */}
          <div className="w-full rounded-2xl p-6 bg-white border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">EST. WAIT</span>
            <div className="font-sans text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1">
              {rec?.etaMin ?? 0}
              <span className="text-base font-semibold text-slate-500">min</span>
            </div>
          </div>

          {/* Card 3: YOUR VISIT TODAY */}
          <div className="w-full rounded-2xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col gap-5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">YOUR VISIT TODAY</span>
            <div className="w-full overflow-x-auto no-scrollbar py-1">
              <StageStepper patient={patient} />
            </div>

            <div className="h-[1px] w-full bg-slate-100" />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Clock
                    className="h-4 w-4"
                    style={{ color: isUrgent ? "var(--state-error)" : "var(--accent-primary)" }}
                  />
                  TIME REMAINING
                </div>
                <div
                  className="font-sans text-base font-bold"
                  style={{ color: isUrgent ? "var(--state-error)" : "var(--text-primary)" }}
                >
                  {timeRemaining} min
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: isUrgent ? "var(--state-error)" : "var(--accent-primary)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: What to Expect */}
          <div className="w-full rounded-2xl p-6 bg-white border border-slate-200/80 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <Clock
                className="h-4.5 w-4.5 shrink-0"
                style={{ color: isUrgent ? "var(--state-error)" : "var(--accent-primary)" }}
              />
              What to Expect — {expectation.title}
            </div>
            <p className="font-sans text-sm text-slate-600 leading-relaxed">
              {expectation.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getVisitProgressPercentage(patient: Patient): number {
  const total = patient.requiredServices.length + 1; // +1 for registration
  const completed = patient.requiredServices.filter((s) => s.done).length + (patient.timeline.length > 0 ? 1 : 0);
  return Math.min(100, Math.max(15, Math.round((completed / total) * 100)));
}

function getExpectation(patient: Patient): { title: string; description: string } {
  const isUrgent = patient.priority === "urgent";
  const stage = patient.currentStage;

  if (isUrgent && stage === "consultation") {
    return {
      title: "Priority Consultation",
      description:
        "Your case has been flagged for priority review. A nurse may check in before the doctor is ready — this is a normal part of the process.",
    };
  }

  switch (stage) {
    case "lab":
      return {
        title: "Laboratory",
        description:
          "A phlebotomist will call your name shortly. The blood draw itself takes about 5 minutes, and results are typically ready within 30–60 minutes.",
      };
    case "xray":
      return {
        title: "X-Ray",
        description:
          "A radiographer will guide you through the imaging procedure. The scan takes approximately 5–10 minutes, and images are transmitted directly to your doctor.",
      };
    case "ecg":
      return {
        title: "ECG",
        description:
          "A technician will attach sensors for a quick heart trace. The procedure takes about 5 minutes and is non-invasive.",
      };
    case "consultation":
      return {
        title: "Consultation",
        description:
          "The doctor will examine your condition and review your test results. Consultations typically take 10–15 minutes.",
      };
    case "pharmacy":
      return {
        title: "Pharmacy",
        description:
          "A pharmacist will dispense your prescriptions and provide instructions. This takes about 5–10 minutes.",
      };
    case "registration":
      return {
        title: "Registration",
        description:
          "Your visit details are registered in the MediFlow system. You will be routed to your first required service automatically.",
      };
    case "done":
      return {
        title: "Visit Complete",
        description:
          "All required medical services for your visit are complete.",
      };
    default:
      return {
        title: stage.toUpperCase(),
        description:
          "Please wait in the patient area until your token is called by hospital staff.",
      };
  }
}

function estimateRemaining(
  patient: Patient,
  minute: number,
): number {
  const remaining = patient.requiredServices.filter((s) => !s.done);
  const durMap: Record<string, number> = {
    lab: 8,
    xray: 9,
    ecg: 6,
    consultation: patient.estimatedConsultationDuration,
  };
  const svcTime = remaining.reduce(
    (sum, service) =>
      sum +
      (patient.currentResourceId && service.kind === patient.currentStage
        ? 0
        : (durMap[service.kind] ?? 5)),
    0,
  );
  const currentRemain =
    patient.serviceEndsAt != null ? Math.max(0, patient.serviceEndsAt - minute) : 0;
  return svcTime + currentRemain;
}

