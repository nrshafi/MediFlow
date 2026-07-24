import { useEffect, useMemo, useState } from "react";
import type { ApiSuccess, DoctorBriefResult } from "@mediflow/shared";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  FlaskConical,
  History,
  Info,
  Loader2,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserRoundSearch,
  UserSearch,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useSim, formatSimClock } from "../store/SimContext";
import type { Patient } from "../lib/types";
import { MicroLabel, MonoTag, Panel, PriorityChip } from "../components/primitives";
import { apiUrl } from "../lib/api";
import { formatBriefContent } from "../lib/brief-format";

export function DoctorBrief() {
  const navigate = useNavigate();
  const { state, geminiRequestHeaders } = useSim();
  const { patients, resources } = state;
  const doctors = useMemo(
    () => resources.filter((resource) => resource.type === "doctor"),
    [resources],
  );
  const [doctorId, setDoctorId] = useState<string | null>(null);
  useEffect(() => {
    if ((!doctorId || !doctors.some((doctor) => doctor.id === doctorId)) && doctors[0]) {
      setDoctorId(doctors[0].id);
    }
  }, [doctorId, doctors]);

  // Queue for the selected doctor: currently-served + queued + those routed to consultation with this doctor
  const queue = useMemo(() => {
    const res = resources.find((r) => r.id === doctorId);
    const ids = res ? [...(res.currentPatientId ? [res.currentPatientId] : []), ...res.queue] : [];
    const direct = ids.map((id) => patients.find((p) => p.id === id)).filter(Boolean) as Patient[];
    return direct;
  }, [resources, patients, doctorId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if ((!selectedId || !queue.find((p) => p.id === selectedId)) && queue.length) {
      setSelectedId(queue[0].id);
    }
  }, [queue, selectedId]);

  const patient = queue.find((p) => p.id === selectedId) ?? queue[0] ?? null;
  const selectNextPatient = () => {
    if (!patient || queue.length < 2) return;
    const currentIndex = queue.findIndex((queuedPatient) => queuedPatient.id === patient.id);
    const nextPatient = queue[(currentIndex + 1) % queue.length];
    if (nextPatient) setSelectedId(nextPatient.id);
  };
  const [brief, setBrief] = useState<DoctorBriefResult | null>(null);
  useEffect(() => {
    if (!patient) {
      setBrief(null);
      return undefined;
    }
    const controller = new AbortController();
    setBrief(null);
    void fetch(apiUrl(`/api/patients/${encodeURIComponent(patient.id)}/brief`), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...geminiRequestHeaders(),
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Brief request failed");
        const body = (await response.json()) as ApiSuccess<DoctorBriefResult>;
        setBrief(body.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBrief(null);
      });
    return () => controller.abort();
  }, [geminiRequestHeaders, patient?.id]);

  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <MicroLabel>03 · CLINICAL BRIEF</MicroLabel>
        <div className="mt-1">
          <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>Doctor Brief</h1>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {doctors.map((d) => {
              const isActive = d.id === doctorId;
              return (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => { setDoctorId(d.id); setSelectedId(null); }}
                  aria-pressed={isActive}
                  className="text-left rounded-md px-3 py-2.5 transition-colors"
                  style={{
                    border: isActive ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                    borderLeft: isActive ? "4px solid var(--accent-primary)" : "1px solid var(--border-default)",
                    backgroundColor: isActive ? "color-mix(in srgb, var(--accent-primary) 8%, var(--bg-surface))" : "var(--bg-surface)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 600, color: isActive ? "var(--accent-primary)" : "var(--text-primary)" }}>{d.name}</div>
                  <div className="font-sans" style={{ fontSize: "12px", color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}>{d.specialty}</div>
                </button>
              );
            })}
          </div>
          <div>
            <div className="mb-2.5">
              <MicroLabel>UPCOMING QUEUE</MicroLabel>
            </div>
            <div className="flex flex-col gap-2 mt-1">
              {queue.length === 0 && (
                <Panel className="flex items-center gap-2 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--state-success)" }} />
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>No patients waiting.</span>
                </Panel>
              )}
              {queue.map((p, i) => {
                const isSel = p.id === (patient?.id);
                const eta = i === 0 ? 0 : queue.slice(0, i).reduce((s, q) => s + q.estimatedConsultationDuration, 0);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    aria-pressed={isSel}
                    className="text-left rounded-xl p-3 transition-colors"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderLeft: isSel ? "3px solid var(--accent-primary)" : "1px solid var(--border-default)",
                      borderLeftWidth: isSel ? "3px" : "1px",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-semibold" style={{ fontSize: "12px", color: "var(--accent-primary)" }}>
                        {p.token}
                      </span>
                      <PriorityChip priority={p.priority} />
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{p.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-sans" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.age} · {p.gender === "male" ? "M" : "F"} · {p.estimatedConsultationDuration}MIN</span>
                      <span className="font-sans font-medium uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        {i === 0 ? "NOW" : `IN ${eta} MIN`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main brief */}
        {patient ? (
          <Brief
            patient={patient}
            minute={state.minute}
            brief={brief}
            hasNextPatient={queue.length > 1}
            onSelectNext={selectNextPatient}
            onViewGuidance={() => navigate(`/patient?patient=${encodeURIComponent(patient.id)}`)}
          />
        ) : (
          <Panel className="flex flex-col items-center justify-center gap-3 text-center p-8" style={{ minHeight: 300 }}>
            <UserSearch className="h-10 w-10 opacity-40" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Select a patient from the queue to view their clinical brief.</span>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Brief({
  patient,
  minute,
  brief,
  hasNextPatient,
  onSelectNext,
  onViewGuidance,
}: {
  patient: Patient;
  minute: number;
  brief: DoctorBriefResult | null;
  hasNextPatient: boolean;
  onSelectNext: () => void;
  onViewGuidance: () => void;
}) {
  const h = patient.history;
  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <Panel className="!p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent-primary) 12%, transparent)" }}
            >
              <User className="h-5.5 w-5.5 shrink-0" style={{ color: "var(--accent-primary)" }} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{patient.name}</span>
                <PriorityChip priority={patient.priority} />
              </div>
              <div className="font-sans mt-1 flex items-center gap-2 flex-wrap" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                <span className="font-medium">
                  {patient.token}
                </span>
                <span>·</span>
                <span>{patient.age} yrs</span>
                <span>·</span>
                <span>{patient.gender === "male" ? "Male" : "Female"}</span>
                <span>·</span>
                <span>
                  ARRIVED {formatSimClock(patient.arrivalTime)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <MonoTag className="!text-[color:var(--accent-primary)] !border-[color:var(--accent-primary)] px-3 py-1">
              {brief?.generatedBy === "gemini" ? "GEMINI BRIEF" : "RECORD BRIEF"}
            </MonoTag>
            <span className="font-sans font-medium uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              GENERATED {formatSimClock(minute)}
            </span>
          </div>
        </div>
      </Panel>

      {/* Pre-Consultation Summary Panel */}
      <Panel className="flex flex-col gap-4 !p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[var(--border-default)]">
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                Pre-Consultation Summary
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Important information compiled before your consultation.
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-1.5 font-sans"
            style={{
              backgroundColor: "var(--bg-base)",
              border: "1px solid var(--border-default)",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <span>Last Updated: {formatSimClock(minute)}</span>
          </div>
        </div>

        {brief ? (
          <>
            <BriefNarrative content={brief.content} />
            <div
              className="flex items-center gap-2.5 rounded-lg p-3"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent)",
              }}
            >
              <Info className="h-4 w-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Please review this information and discuss any updates with your healthcare provider.
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-4" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <p style={{ fontSize: "14px" }}>Preparing the patient record summary…</p>
          </div>
        )}
      </Panel>

      {/* Allergies — full width */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: h.allergies.length ? "color-mix(in srgb, var(--state-error) 8%, var(--bg-surface))" : "color-mix(in srgb, var(--state-success) 6%, var(--bg-surface))",
          border: `1px solid ${h.allergies.length ? "color-mix(in srgb, var(--state-error) 35%, var(--border-default))" : "color-mix(in srgb, var(--state-success) 25%, var(--border-default))"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: h.allergies.length ? "color-mix(in srgb, var(--state-error) 15%, transparent)" : "color-mix(in srgb, var(--state-success) 14%, transparent)",
            }}
          >
            {h.allergies.length ? (
              <ShieldAlert className="h-4 w-4" style={{ color: "var(--state-error)" }} />
            ) : (
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--state-success)" }} />
            )}
          </div>
          <MicroLabel>{h.allergies.length ? "CRITICAL ALLERGIES" : "ALLERGIES"}</MicroLabel>
        </div>
        {h.allergies.length ? (
          <div className="flex flex-col gap-2">
            {h.allergies.map((a) => (
              <div key={a.substance} className="flex items-center justify-between">
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{a.substance} → {a.reaction}</span>
                <span className="font-sans font-semibold uppercase rounded-full px-2.5 py-[2px]" style={{ fontSize: "10px", color: "var(--state-error)", border: "1px solid var(--state-error)", backgroundColor: "color-mix(in srgb, var(--state-error) 10%, transparent)" }}>{a.severity}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5" style={{ fontSize: "14px", fontWeight: 600, color: "var(--state-success)" }}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>No known allergies</span>
          </div>
        )}
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BriefSection
          title="PREVIOUS DIAGNOSES"
          badgeText={`${h.diagnoses.length} ${h.diagnoses.length === 1 ? "Condition" : "Conditions"}`}
          badgeIcon={FileText}
        >
          {h.diagnoses.map((d) => (
            <Row key={d.condition} left={d.condition} right={String(d.year)} />
          ))}
        </BriefSection>

        <BriefSection
          title="CURRENT MEDICATIONS"
          badgeText={`${h.medications.length} ${h.medications.length === 1 ? "Medication" : "Medications"}`}
          badgeIcon={Pill}
        >
          {h.medications.map((m) => (
            <Row key={m.name} left={<span className="font-sans font-medium" style={{ fontSize: "13px" }}>{m.name} · {m.dose}</span>} right={m.frequency} />
          ))}
        </BriefSection>

        <BriefSection
          title="RECENT TEST RESULTS"
          badgeText={`${h.recentTests.length} ${h.recentTests.length === 1 ? "Test" : "Tests"}`}
          badgeIcon={FlaskConical}
        >
          {h.recentTests.map((t) => (
            <div key={t.test} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--border-default) 60%, transparent)" }}>
              <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{t.test}</span>
              <span className="font-sans font-semibold flex items-center gap-1" style={{ fontSize: "12px", color: t.flag === "abnormal" ? "var(--state-error)" : "var(--text-muted)" }}>
                {t.flag === "abnormal" && <TrendingUp className="h-3.5 w-3.5 text-[var(--state-error)] shrink-0" />}{t.value}
              </span>
            </div>
          ))}
        </BriefSection>

        <BriefSection
          title="TREATMENT HISTORY"
          badgeText={h.treatments[0]?.date ? `Latest: ${h.treatments[0].date}` : `${h.treatments.length} ${h.treatments.length === 1 ? "Procedure" : "Procedures"}`}
          badgeIcon={Calendar}
        >
          {h.treatments.length ? h.treatments.map((t) => (
            <div key={t.procedure} className="py-1.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--border-default) 60%, transparent)" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{t.procedure}</span>
                <span className="font-sans" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {t.date}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.note}</span>
            </div>
          )) : <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>No recorded procedures.</span>}
        </BriefSection>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onViewGuidance}
          className="font-mono uppercase rounded-md px-5 h-10 flex items-center gap-2 transition-[filter] hover:brightness-110"
          style={{ fontSize: "12px", letterSpacing: "0.08em", backgroundColor: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          <UserRoundSearch className="size-4" aria-hidden="true" />
          VIEW PATIENT GUIDANCE
        </button>
        {hasNextPatient ? (
          <button
            type="button"
            onClick={onSelectNext}
            className="font-mono uppercase rounded-md px-5 h-10 flex items-center gap-2 transition-colors hover:bg-[var(--bg-raised)]"
            style={{ fontSize: "12px", letterSpacing: "0.08em", border: "1px solid var(--border-default)", color: "var(--text-primary)", backgroundColor: "transparent" }}
          >
            NEXT QUEUE PATIENT
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Generated from historical records — verify critical details.</span>
      </div>
    </section>
  );
}

function getSectionConfig(label: string | null, text: string) {
  const normLabel = (label ?? "").toLowerCase();
  const normText = text.toLowerCase();
  const isNone = /none|no known|n\/a|nil/i.test(normText);

  // Helper to count comma/semicolon/newline separated list items
  const countItems = (t: string) => {
    const list = t.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    return list.length || 1;
  };

  if (normLabel.includes("allerg")) {
    if (isNone) {
      return {
        icon: ShieldCheck,
        color: "var(--accent-primary)",
        bgTint: "color-mix(in srgb, var(--accent-primary) 5%, var(--bg-surface))",
        borderColor: "color-mix(in srgb, var(--accent-primary) 22%, var(--border-default))",
        iconCircleBg: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
        badgeText: "Clear",
        badgeIcon: ShieldCheck,
        badgeBg: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
      };
    }
    const count = countItems(text);
    return {
      icon: ShieldAlert,
      color: "var(--state-error)",
      bgTint: "color-mix(in srgb, var(--state-error) 7%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, var(--state-error) 40%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, var(--state-error) 15%, transparent)",
      badgeText: `${count} ${count === 1 ? "Allergy" : "Allergies"}`,
      badgeIcon: AlertTriangle,
      badgeBg: "color-mix(in srgb, var(--state-error) 12%, transparent)",
    };
  }

  if (normLabel.includes("abnormal")) {
    return {
      icon: TrendingUp,
      color: "var(--state-error)",
      bgTint: "color-mix(in srgb, var(--state-error) 6%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, var(--state-error) 35%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, var(--state-error) 14%, transparent)",
      badgeText: "Needs Review",
      badgeIcon: AlertTriangle,
      badgeBg: "color-mix(in srgb, var(--state-error) 12%, transparent)",
    };
  }

  if (normLabel.includes("diagnos")) {
    const count = countItems(text);
    return {
      icon: Activity,
      color: "var(--accent-primary)",
      bgTint: "color-mix(in srgb, var(--accent-primary) 5%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, var(--accent-primary) 22%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
      badgeText: `${count} ${count === 1 ? "Condition" : "Conditions"}`,
      badgeIcon: FileText,
      badgeBg: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
    };
  }

  if (normLabel.includes("medicat")) {
    const count = countItems(text);
    return {
      icon: Pill,
      color: "var(--accent-secondary)",
      bgTint: "color-mix(in srgb, var(--accent-secondary) 6%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, var(--accent-secondary) 25%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, var(--accent-secondary) 14%, transparent)",
      badgeText: `${count} ${count === 1 ? "Medication" : "Medications"}`,
      badgeIcon: Pill,
      badgeBg: "color-mix(in srgb, var(--accent-secondary) 12%, transparent)",
    };
  }

  if (normLabel.includes("test")) {
    const count = countItems(text);
    return {
      icon: FlaskConical,
      color: "#7C3AED",
      bgTint: "color-mix(in srgb, #7C3AED 5%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, #7C3AED 22%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, #7C3AED 12%, transparent)",
      badgeText: `${count} ${count === 1 ? "Test" : "Tests"}`,
      badgeIcon: FlaskConical,
      badgeBg: "color-mix(in srgb, #7C3AED 10%, transparent)",
    };
  }

  if (normLabel.includes("treatment")) {
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i);
    const count = countItems(text);
    const badgeText = dateMatch ? `Latest: ${dateMatch[0]}` : `${count} ${count === 1 ? "Procedure" : "Procedures"}`;
    return {
      icon: History,
      color: "var(--state-warning)",
      bgTint: "color-mix(in srgb, var(--state-warning) 6%, var(--bg-surface))",
      borderColor: "color-mix(in srgb, var(--state-warning) 28%, var(--border-default))",
      iconCircleBg: "color-mix(in srgb, var(--state-warning) 14%, transparent)",
      badgeText,
      badgeIcon: Calendar,
      badgeBg: "color-mix(in srgb, var(--state-warning) 12%, transparent)",
    };
  }

  return {
    icon: Sparkles,
    color: "var(--accent-primary)",
    bgTint: "color-mix(in srgb, var(--accent-primary) 4%, var(--bg-surface))",
    borderColor: "var(--border-default)",
    iconCircleBg: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
    badgeText: "Summary",
    badgeIcon: FileText,
    badgeBg: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
  };
}

function BriefNarrative({ content }: { content: string }) {
  const sections = formatBriefContent(content);

  if (sections.length === 0) {
    return (
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-muted)" }}>
        No summary was returned.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => {
        if (!section.label) {
          return (
            <p
              key={`summary-${index}`}
              className="rounded-xl border p-3.5"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 4%, var(--bg-surface))",
                color: "var(--text-primary)",
                fontSize: "14px",
                lineHeight: 1.7,
              }}
            >
              {section.text}
            </p>
          );
        }

        const config = getSectionConfig(section.label, section.text);
        const IconComponent = config.icon;
        const BadgeIconComponent = config.badgeIcon;

        return (
          <div
            key={`${section.label}-${index}`}
            className="flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all"
            style={{
              borderColor: config.borderColor,
              backgroundColor: config.bgTint,
            }}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: config.iconCircleBg }}
              >
                <IconComponent className="h-4.5 w-4.5" style={{ color: config.color }} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className="font-sans font-bold uppercase tracking-wider"
                  style={{
                    color: config.color,
                    fontSize: "11px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {section.label}
                </span>
                <span
                  className="truncate sm:whitespace-normal font-sans"
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 400,
                    lineHeight: 1.4,
                  }}
                >
                  {section.text}
                </span>
              </div>
            </div>

            <div
              className="hidden sm:flex shrink-0 items-center rounded-full px-2.5 py-1 font-sans font-semibold uppercase tracking-wider"
              style={{
                fontSize: "10px",
                color: config.color,
                backgroundColor: config.badgeBg,
                border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
              }}
            >
              <span>{config.badgeText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BriefSection({
  title,
  badgeText,
  badgeIcon: BadgeIcon,
  children,
}: {
  title: string;
  badgeText?: string;
  badgeIcon?: React.ElementType;
  children: React.ReactNode;
}) {
  const config = getSectionConfig(title, "");
  const IconComponent = config.icon;
  const BadgeIconComponent = BadgeIcon ?? config.badgeIcon;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4 transition-all"
      style={{
        borderColor: config.borderColor,
        backgroundColor: config.bgTint,
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[color-mix(in_srgb,var(--border-default)_60%,transparent)]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: config.iconCircleBg }}
          >
            <IconComponent className="h-4 w-4" style={{ color: config.color }} />
          </div>
          <span
            className="font-sans font-bold uppercase tracking-wider"
            style={{
              color: config.color,
              fontSize: "11px",
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {title}
          </span>
        </div>

        {badgeText && (
          <div
            className="hidden sm:flex shrink-0 items-center rounded-full px-2.5 py-1 font-sans font-semibold uppercase tracking-wider"
            style={{
              fontSize: "10px",
              color: config.color,
              backgroundColor: config.badgeBg,
              border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
            }}
          >
            <span>{badgeText}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-default)" }}>
      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{left}</span>
      <span className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{right}</span>
    </div>
  );
}

