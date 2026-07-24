import { useEffect, useMemo, useState } from "react";
import type { ApiSuccess, DoctorBriefResult } from "@mediflow/shared";
import { AlertTriangle, ArrowRight, UserRoundSearch } from "lucide-react";
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
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>Doctor Brief</h1>
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
                  className="text-left rounded-md px-3 py-2 transition-colors"
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
            <MicroLabel>UPCOMING QUEUE</MicroLabel>
            <div className="flex flex-col gap-2 mt-3">
              {queue.length === 0 && (
                <Panel><span style={{ fontSize: "13px", color: "var(--text-muted)" }}>No patients waiting.</span></Panel>
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
                      <span className="font-sans font-semibold" style={{ fontSize: "12px", color: "var(--accent-primary)" }}>{p.token}</span>
                      <PriorityChip priority={p.priority} />
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{p.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-sans" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.age} · {p.gender === "male" ? "M" : "F"} · {p.estimatedConsultationDuration}MIN</span>
                      <span className="font-sans font-medium uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{i === 0 ? "NOW" : `IN ${eta} MIN`}</span>
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
          <Panel className="flex items-center justify-center" style={{ minHeight: 300 }}>
            <span style={{ color: "var(--text-muted)" }}>Select a patient to view their brief.</span>
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
      <Panel>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>{patient.name}</span>
              <PriorityChip priority={patient.priority} />
            </div>
            <div className="font-sans mt-1" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {patient.token} · {patient.age} yrs · {patient.gender === "male" ? "Male" : "Female"} · ARRIVED {formatSimClock(patient.arrivalTime)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MonoTag className="!text-[color:var(--accent-primary)] !border-[color:var(--accent-primary)]">
              {brief?.generatedBy === "gemini" ? "GEMINI BRIEF" : "RECORD BRIEF"}
            </MonoTag>
            <span className="font-sans font-medium uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>GENERATED {formatSimClock(minute)}</span>
          </div>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <MicroLabel>PRE-CONSULTATION SUMMARY</MicroLabel>
        {brief ? (
          <BriefNarrative content={brief.content} />
        ) : (
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-muted)" }}>
            Preparing the patient record summary…
          </p>
        )}
      </Panel>

      {/* Allergies — full width, error tint */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: h.allergies.length ? "color-mix(in srgb, var(--state-error) 10%, transparent)" : "color-mix(in srgb, var(--state-success) 10%, transparent)", border: `1px solid ${h.allergies.length ? "var(--state-error)" : "var(--border-default)"}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4" style={{ color: h.allergies.length ? "var(--state-error)" : "var(--state-success)" }} />
          <MicroLabel>ALLERGIES</MicroLabel>
        </div>
        {h.allergies.length ? (
          <div className="flex flex-col gap-2">
            {h.allergies.map((a) => (
              <div key={a.substance} className="flex items-center justify-between">
                <span style={{ fontSize: "14px", color: "var(--text-primary)" }}>{a.substance} → {a.reaction}</span>
                <span className="font-sans font-semibold uppercase rounded-full px-2 py-[2px]" style={{ fontSize: "10px", color: "var(--state-error)", border: "1px solid var(--state-error)" }}>{a.severity}</span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: "14px", color: "var(--state-success)" }}>No known allergies</span>
        )}
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BriefSection title="PREVIOUS DIAGNOSES">
          {h.diagnoses.map((d) => (
            <Row key={d.condition} left={d.condition} right={String(d.year)} />
          ))}
        </BriefSection>

        <BriefSection title="CURRENT MEDICATIONS">
          {h.medications.map((m) => (
            <Row key={m.name} left={<span className="font-sans" style={{ fontSize: "13px" }}>{m.name} · {m.dose}</span>} right={m.frequency} />
          ))}
        </BriefSection>

        <BriefSection title="RECENT TEST RESULTS">
          {h.recentTests.map((t) => (
            <div key={t.test} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t.test}</span>
              <span className="font-sans font-medium flex items-center gap-1" style={{ fontSize: "12px", color: t.flag === "abnormal" ? "var(--state-error)" : "var(--text-muted)" }}>
                {t.flag === "abnormal" && <span>▲</span>}{t.value}
              </span>
            </div>
          ))}
        </BriefSection>

        <BriefSection title="TREATMENT HISTORY">
          {h.treatments.length ? h.treatments.map((t) => (
            <div key={t.procedure} className="py-1.5" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t.procedure}</span>
                <span className="font-sans" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.date}</span>
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
    <div className="flex flex-col gap-2">
      {sections.map((section, index) => {
        if (!section.label) {
          return (
            <p
              key={`summary-${index}`}
              className="rounded-md border px-3 py-2.5"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "color-mix(in srgb, var(--accent-primary) 4%, transparent)",
                color: "var(--text-primary)",
                fontSize: "14px",
                lineHeight: 1.7,
              }}
            >
              {section.text}
            </p>
          );
        }

        const isAttention = section.tone === "attention";
        return (
          <div
            key={`${section.label}-${index}`}
            className="grid grid-cols-1 gap-1 rounded-md border px-3 py-2.5 sm:grid-cols-[minmax(150px,0.32fr)_1fr] sm:gap-4"
            style={{
              borderColor: isAttention
                ? "color-mix(in srgb, var(--state-error) 45%, var(--border-default))"
                : "var(--border-default)",
              backgroundColor: isAttention
                ? "color-mix(in srgb, var(--state-error) 6%, transparent)"
                : "color-mix(in srgb, var(--accent-primary) 4%, transparent)",
            }}
          >
            <span
              className="font-sans font-semibold uppercase"
              style={{
                color: isAttention ? "var(--state-error)" : "var(--accent-primary)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                lineHeight: 1.6,
              }}
            >
              {section.label}
            </span>
            <span
              style={{
                color: "var(--text-primary)",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {section.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="flex flex-col gap-2">
      <MicroLabel>{title}</MicroLabel>
      <div className="flex flex-col">{children}</div>
    </Panel>
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
