import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useSim, formatSimClock } from "../store/SimContext";
import { DOCTORS } from "../lib/seed";
import type { Patient } from "../lib/types";
import { MicroLabel, MonoTag, Panel, PriorityChip, GuardrailNote } from "../components/primitives";

export function DoctorBrief() {
  const { state } = useSim();
  const { patients, resources } = state;
  const [doctorId, setDoctorId] = useState(DOCTORS[0].id);

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
            {DOCTORS.map((d) => {
              const isActive = d.id === doctorId;
              return (
                <button
                  key={d.id}
                  onClick={() => { setDoctorId(d.id); setSelectedId(null); }}
                  className="text-left rounded-md px-3 py-2 transition-colors"
                  style={{
                    border: "1px solid var(--border-default)",
                    backgroundColor: isActive ? "var(--bg-raised)" : "var(--bg-surface)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div style={{ fontSize: "14px" }}>{d.name}</div>
                  <div className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.specialty}</div>
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
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="text-left rounded-xl p-3 transition-colors"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderLeft: isSel ? "3px solid var(--accent-primary)" : "1px solid var(--border-default)",
                      borderLeftWidth: isSel ? "3px" : "1px",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono" style={{ fontSize: "12px", color: "var(--accent-primary)" }}>{p.token}</span>
                      <PriorityChip priority={p.priority} />
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: 2 }}>{p.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.age} · {p.gender === "male" ? "M" : "F"} · {p.estimatedConsultationDuration}MIN</span>
                      <span className="font-mono uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{i === 0 ? "NOW" : `IN ${eta} MIN`}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main brief */}
        {patient ? <Brief patient={patient} minute={state.minute} /> : (
          <Panel className="flex items-center justify-center" style={{ minHeight: 300 }}>
            <span style={{ color: "var(--text-muted)" }}>Select a patient to view their brief.</span>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Brief({ patient, minute }: { patient: Patient; minute: number }) {
  const h = patient.history;
  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <Panel>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: "20px", color: "var(--text-primary)" }}>{patient.name}</span>
              <PriorityChip priority={patient.priority} />
            </div>
            <div className="font-mono mt-1" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {patient.token} · {patient.age} yrs · {patient.gender === "male" ? "Male" : "Female"} · ARRIVED {formatSimClock(patient.arrivalTime)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MonoTag className="!text-[color:var(--accent-primary)] !border-[color:var(--accent-primary)]">AI-GENERATED BRIEF</MonoTag>
            <span className="font-mono uppercase" style={{ fontSize: "10px", color: "var(--text-muted)" }}>GENERATED {formatSimClock(minute)}</span>
          </div>
        </div>
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
                <span className="font-mono uppercase rounded-full px-2 py-[2px]" style={{ fontSize: "10px", color: "var(--state-error)", border: "1px solid var(--state-error)" }}>{a.severity}</span>
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
            <Row key={m.name} left={<span className="font-mono" style={{ fontSize: "13px" }}>{m.name} · {m.dose}</span>} right={m.frequency} />
          ))}
        </BriefSection>

        <BriefSection title="RECENT TEST RESULTS">
          {h.recentTests.map((t) => (
            <div key={t.test} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t.test}</span>
              <span className="font-mono flex items-center gap-1" style={{ fontSize: "12px", color: t.flag === "abnormal" ? "var(--state-error)" : "var(--text-muted)" }}>
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
                <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.date}</span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.note}</span>
            </div>
          )) : <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>No recorded procedures.</span>}
        </BriefSection>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="font-mono uppercase rounded-md px-5 h-10 flex items-center"
          style={{ fontSize: "12px", letterSpacing: "0.08em", backgroundColor: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          START CONSULTATION
        </button>
        <button
          className="font-mono uppercase rounded-md px-5 h-10 flex items-center"
          style={{ fontSize: "12px", letterSpacing: "0.08em", border: "1px solid var(--border-default)", color: "var(--text-muted)", backgroundColor: "transparent" }}
        >
          SKIP / NEXT PATIENT
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Generated from historical records — verify critical details.</span>
        <GuardrailNote />
      </div>
    </section>
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
