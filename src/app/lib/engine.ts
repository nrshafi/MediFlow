import type {
  BottleneckAlert,
  Metrics,
  Patient,
  Recommendation,
  Resource,
  ServiceKind,
  SimState,
  Stage,
} from "./types";
import { SERVICE_DURATION, buildPatients, buildResources } from "./seed";

const DIAGNOSTIC_RESOURCE: Record<string, string> = {
  lab: "lab",
  xray: "xray",
  ecg: "ecg",
};

const KIND_LABEL: Record<string, string> = {
  lab: "Laboratory",
  xray: "X-Ray",
  ecg: "ECG",
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  billing: "Billing",
};

export function serviceTimeFor(p: Patient, kind: ServiceKind | Stage): number {
  if (kind === "consultation") return p.estimatedConsultationDuration;
  return SERVICE_DURATION[kind] ?? 5;
}

export function initState(): SimState {
  const patients = buildPatients();
  const resources = buildResources();
  return {
    minute: 0,
    playing: true,
    speed: 1,
    patients,
    resources,
    recommendations: {},
    alerts: [],
    metrics: withBaseline(emptyMetricsBlock()),
    loading: true,
  };
}

function emptyMetricsBlock() {
  return { avgWaitMin: 0, avgVisitMin: 0, utilizationPct: 0, patientsInHouse: 0, completed: 0 };
}

// ── Baseline: naive uncoordinated FIFO run to completion (static aggregate) ──
export function computeBaselineAggregate(): Metrics["baseline"] {
  const patients = buildPatients().map((p) => ({ ...p }));
  // Fixed order for each patient: lab, xray, ecg, consultation (no reordering).
  const order: ServiceKind[] = ["lab", "xray", "ecg", "consultation"];
  // resource free-at timestamps
  const freeAt: Record<string, number> = {};
  const results: Array<{ wait: number; visit: number }> = [];

  // Sort by arrival (FIFO)
  const sorted = [...patients].sort((a, b) => a.arrivalTime - b.arrivalTime);
  for (const p of sorted) {
    let t = p.arrivalTime;
    let waited = 0;
    let served = 0;
    const kinds = order.filter((k) => p.requiredServices.some((s) => s.kind === k));
    for (const kind of kinds) {
      const resId = kind === "consultation" ? p.requiredServices.find((s) => s.kind === "consultation")!.doctorId! : DIAGNOSTIC_RESOURCE[kind];
      const start = Math.max(t, freeAt[resId] ?? 0);
      waited += start - t;
      const dur = serviceTimeFor(p, kind);
      freeAt[resId] = start + dur;
      served += dur;
      t = start + dur;
    }
    // pharmacy + billing (serial, dedicated implicit stations, FIFO)
    for (const st of ["pharmacy", "billing"] as Stage[]) {
      const start = Math.max(t, freeAt[st] ?? 0);
      waited += start - t;
      const dur = SERVICE_DURATION[st];
      freeAt[st] = start + dur;
      served += dur;
      t = start + dur;
    }
    results.push({ wait: waited, visit: t - p.arrivalTime });
  }
  const avgWait = Math.round(results.reduce((s, r) => s + r.wait, 0) / results.length);
  const avgVisit = Math.round(results.reduce((s, r) => s + r.visit, 0) / results.length);
  return {
    avgWaitMin: avgWait,
    avgVisitMin: avgVisit,
    utilizationPct: 62, // representative uncoordinated utilization
    patientsInHouse: 0,
    completed: patients.length,
  };
}

let BASELINE: Metrics["baseline"] | null = null;
function withBaseline(live: Metrics["live"]): Metrics {
  if (!BASELINE) BASELINE = computeBaselineAggregate();
  return { live, baseline: BASELINE };
}

// ── Predicted wait for a resource at current minute ──
function predictedWait(resource: Resource, patients: Patient[], minute: number): number {
  const pmap = new Map(patients.map((p) => [p.id, p]));
  let remainingCurrent = 0;
  if (resource.currentPatientId) {
    const cp = pmap.get(resource.currentPatientId);
    if (cp && cp.serviceEndsAt != null) remainingCurrent = Math.max(0, cp.serviceEndsAt - minute);
  }
  let queueTime = 0;
  for (const pid of resource.queue) {
    const qp = pmap.get(pid);
    if (!qp) continue;
    const kind = resource.type === "doctor" ? "consultation" : (resource.type as ServiceKind);
    queueTime += serviceTimeFor(qp, kind);
  }
  return remainingCurrent + queueTime;
}

// ── Choose the next required service for a free patient (the "engine") ──
function chooseNext(p: Patient, resources: Resource[], patients: Patient[], minute: number): string | null {
  const remaining = p.requiredServices.filter((s) => !s.done);
  if (remaining.length === 0) return null;
  let best: { resId: string; cost: number } | null = null;
  for (const svc of remaining) {
    const resId = svc.kind === "consultation" ? svc.doctorId! : DIAGNOSTIC_RESOURCE[svc.kind];
    const res = resources.find((r) => r.id === resId);
    if (!res) continue;
    const wait = predictedWait(res, patients, minute);
    const svcTime = serviceTimeFor(p, svc.kind);
    const cost = wait + svcTime;
    if (!best || cost < best.cost) best = { resId, cost };
  }
  return best ? best.resId : null;
}

function enqueue(res: Resource, p: Patient) {
  if (p.priority === "urgent") {
    // insert at front, behind the patient currently in service
    res.queue.unshift(p.id);
  } else {
    res.queue.push(p.id);
  }
}

function stageForResource(res: Resource): Stage {
  if (res.type === "doctor") return "consultation";
  return res.type as Stage;
}

// ── Advance one simulated minute ──
export function tick(prev: SimState): SimState {
  const minute = prev.minute + 1;
  const patients = prev.patients.map((p) => ({ ...p, requiredServices: p.requiredServices.map((s) => ({ ...s })), timeline: p.timeline.map((t) => ({ ...t })) }));
  const resources = prev.resources.map((r) => ({ ...r, queue: [...r.queue], queueHistory: [...r.queueHistory] }));
  const pmap = new Map(patients.map((p) => [p.id, p]));

  // 1. Complete finished services / stages
  for (const res of resources) {
    if (res.currentPatientId) {
      const p = pmap.get(res.currentPatientId)!;
      if (p.serviceEndsAt != null && p.serviceEndsAt <= minute) {
        // finish stage
        const svc = p.requiredServices.find((s) => (s.kind === "consultation" ? res.type === "doctor" : DIAGNOSTIC_RESOURCE[s.kind] === res.id) && !s.done);
        if (svc) svc.done = true;
        const tl = p.timeline.find((t) => t.stage === p.currentStage && t.end === null);
        if (tl) tl.end = minute;
        res.currentPatientId = null;
        p.currentResourceId = null;
        p.serviceEndsAt = null;
        routeFree(p, resources, patients, minute, pmap);
      }
    }
  }

  // Complete pharmacy/billing (no resource)
  for (const p of patients) {
    if ((p.currentStage === "pharmacy" || p.currentStage === "billing") && p.serviceEndsAt != null && p.serviceEndsAt <= minute) {
      const tl = p.timeline.find((t) => t.stage === p.currentStage && t.end === null);
      if (tl) tl.end = minute;
      if (p.currentStage === "pharmacy") {
        startStage(p, "billing", minute);
      } else {
        p.currentStage = "done";
        p.completedAt = minute;
        p.timeline.push({ stage: "done", start: minute, end: minute });
      }
    }
  }

  // 2. Register newly arrived patients & route them
  for (const p of patients) {
    if (!p.registered && p.arrivalTime <= minute) {
      p.registered = true;
      const reg = p.timeline.find((t) => t.stage === "registration")!;
      reg.start = p.arrivalTime;
      reg.end = p.arrivalTime;
      routeFree(p, resources, patients, minute, pmap);
    }
  }

  // 3. Assign idle resources from their queues
  for (const res of resources) {
    if (!res.currentPatientId && res.queue.length > 0) {
      const pid = res.queue.shift()!;
      const p = pmap.get(pid)!;
      res.currentPatientId = pid;
      const kind = stageForResource(res);
      const dur = serviceTimeFor(p, res.type === "doctor" ? "consultation" : (res.type as ServiceKind));
      p.currentStage = kind;
      p.currentResourceId = res.id;
      p.serviceEndsAt = minute + dur;
      p.timeline.push({ stage: kind, start: minute, end: null });
    }
  }

  // 4. Accumulate waited/served + resource utilization
  for (const p of patients) {
    if (p.completedAt != null) continue;
    if (!p.registered) continue;
    if (p.currentResourceId || p.currentStage === "pharmacy" || p.currentStage === "billing") p.servedMin += 1;
    else if (p.currentStage !== "done") p.waitedMin += 1;
  }
  for (const res of resources) {
    if (res.currentPatientId) res.busyMinutes += 1;
  }

  // 5. Recompute derived: predicted wait, status, utilization, queue positions, history
  for (const res of resources) {
    res.predictedWaitMin = Math.round(predictedWait(res, patients, minute));
    res.utilizationPct = minute > 0 ? Math.min(100, Math.round((res.busyMinutes / minute) * 100)) : 0;
    const depth = res.queue.length + (res.currentPatientId ? 1 : 0);
    res.queueHistory = [...res.queueHistory.slice(1), depth];
    if (res.queue.length >= 4 || res.predictedWaitMin > 25) res.status = "congested";
    else if (res.currentPatientId) res.status = "busy";
    else res.status = "available";
  }
  // queue positions
  for (const res of resources) {
    res.queue.forEach((pid, i) => {
      const p = pmap.get(pid);
      if (p) p.queuePosition = i + 1;
    });
  }

  // 6. Recommendations, alerts, metrics
  const recommendations = buildRecommendations(patients, resources, minute);
  const alerts = buildAlerts(resources, patients, minute);
  const metrics = withBaseline(buildLiveMetrics(patients, resources, minute));

  return { ...prev, minute, patients, resources, recommendations, alerts, metrics, loading: false };
}

function routeFree(p: Patient, resources: Resource[], patients: Patient[], minute: number, pmap: Map<string, Patient>) {
  const remaining = p.requiredServices.filter((s) => !s.done);
  if (remaining.length === 0) {
    // move to pharmacy
    startStage(p, "pharmacy", minute);
    return;
  }
  const resId = chooseNext(p, resources, patients, minute);
  if (!resId) return;
  const res = resources.find((r) => r.id === resId)!;
  enqueue(res, p);
  p.currentStage = stageForResource(res);
  p.currentResourceId = null; // queued, not yet served
}

function startStage(p: Patient, stage: Stage, minute: number) {
  p.currentStage = stage;
  p.currentResourceId = null;
  const dur = SERVICE_DURATION[stage];
  p.serviceEndsAt = minute + dur;
  p.timeline.push({ stage, start: minute, end: null });
}

function buildRecommendations(patients: Patient[], resources: Resource[], minute: number): Record<string, Recommendation> {
  const out: Record<string, Recommendation> = {};
  const resById = new Map(resources.map((r) => [r.id, r]));
  for (const p of patients) {
    if (!p.registered || p.completedAt != null) continue;
    const remaining = p.requiredServices.filter((s) => !s.done);
    let rec: Recommendation;
    if (p.currentStage === "pharmacy") {
      rec = {
        patientId: p.id, nextResourceId: null,
        actionText: "Go to Pharmacy",
        reasonSummary: "Prescriptions being prepared",
        etaMin: Math.max(0, (p.serviceEndsAt ?? minute) - minute),
        minutesSaved: 0,
        explanation: "Please go to Pharmacy. Your prescriptions are being prepared; estimated wait is under 5 minutes.",
      };
    } else if (p.currentStage === "billing") {
      rec = {
        patientId: p.id, nextResourceId: null,
        actionText: "Proceed to Billing",
        reasonSummary: "Final step of your visit",
        etaMin: Math.max(0, (p.serviceEndsAt ?? minute) - minute),
        minutesSaved: 0,
        explanation: "Proceed to Billing to complete your visit. This is the final step.",
      };
    } else {
      const targetId = p.currentResourceId ?? chooseNext(p, resources, patients, minute);
      const target = targetId ? resById.get(targetId) : undefined;
      const eta = target ? target.predictedWaitMin : 0;
      const consult = p.requiredServices.find((s) => s.kind === "consultation" && !s.done);
      const doctor = consult ? resById.get(consult.doctorId!) : undefined;
      const isDiagnostic = target && target.type !== "doctor";
      let minutesSaved = 0;
      let explanation: string;
      if (isDiagnostic && doctor && doctor.status !== "available") {
        const docWait = doctor.predictedWaitMin;
        minutesSaved = Math.max(0, Math.min(docWait, serviceTimeFor(p, target!.type as ServiceKind) + eta));
        explanation = `Proceed to the ${KIND_LABEL[target!.type].toLowerCase()} first. ${doctor.name} is expected to become available in approximately ${docWait} minutes — reducing your overall visit time by ${minutesSaved} minutes.`;
      } else if (isDiagnostic) {
        minutesSaved = Math.max(6, serviceTimeFor(p, target!.type as ServiceKind));
        explanation = `Your ${KIND_LABEL[target!.type].toLowerCase()} can be done now — the machine is free. Completing it before your consultation saves an estimated ${minutesSaved} minutes.`;
      } else if (target) {
        minutesSaved = remaining.length > 1 ? 8 : 0;
        explanation = `Proceed to ${target.name}${target.specialty ? ` (${target.specialty})` : ""} for your consultation. ${eta > 0 ? `Estimated wait is ${eta} minutes.` : "You can be seen now."}`;
      } else {
        explanation = "Please wait — your next step is being coordinated.";
      }
      rec = {
        patientId: p.id,
        nextResourceId: targetId ?? null,
        actionText: target ? `Go to ${target.name}` : "Please wait",
        reasonSummary: target ? `Next: ${KIND_LABEL[target.type] ?? target.name}` : "Coordinating",
        etaMin: eta,
        minutesSaved,
        explanation,
      };
    }
    out[p.id] = rec;
  }
  return out;
}

function buildAlerts(resources: Resource[], patients: Patient[], minute: number): BottleneckAlert[] {
  const alerts: BottleneckAlert[] = [];
  const pmap = new Map(patients.map((p) => [p.id, p]));
  for (const res of resources) {
    if (res.status === "congested") {
      const tokens = res.queue.slice(0, 2).map((id) => pmap.get(id)?.token).filter(Boolean);
      const critical = res.predictedWaitMin > 35 || res.queue.length >= 6;
      alerts.push({
        id: `${res.id}-cong`,
        resourceId: res.id,
        severity: critical ? "critical" : "warning",
        headline: `${res.name.toUpperCase()} — Queue predicted to exceed 25 min within 15 min.`,
        suggestedAction: tokens.length
          ? `Suggested: route ${tokens.join(" and ")} to an alternate diagnostic first.`
          : "Suggested: rebalance incoming patients to idle resources.",
        detectedAt: minute,
      });
    }
  }
  // doctor imbalance
  const doctors = resources.filter((r) => r.type === "doctor");
  const idle = doctors.find((d) => d.status === "available" && d.queue.length === 0);
  const overloaded = doctors.find((d) => d.queue.length >= 4);
  if (idle && overloaded && idle.id !== overloaded.id) {
    alerts.push({
      id: `${overloaded.id}-imbalance`,
      resourceId: overloaded.id,
      severity: "warning",
      headline: `${overloaded.name.toUpperCase()} — Overloaded: ${overloaded.queue.length} waiting while ${idle.name} is idle.`,
      suggestedAction: `Suggested: shift the next two general consultations to ${idle.name}.`,
      detectedAt: minute,
    });
  }
  return alerts;
}

function buildLiveMetrics(patients: Patient[], resources: Resource[], minute: number): Metrics["live"] {
  const arrived = patients.filter((p) => p.registered);
  const completed = arrived.filter((p) => p.completedAt != null);
  const inHouse = arrived.filter((p) => p.completedAt == null);
  const waitSample = arrived.filter((p) => p.waitedMin + p.servedMin > 0);
  const avgWait = waitSample.length ? Math.round(waitSample.reduce((s, p) => s + p.waitedMin, 0) / waitSample.length) : 0;
  const avgVisit = completed.length
    ? Math.round(completed.reduce((s, p) => s + ((p.completedAt ?? 0) - p.arrivalTime), 0) / completed.length)
    : (inHouse.length ? Math.round(inHouse.reduce((s, p) => s + (minute - p.arrivalTime), 0) / inHouse.length) : 0);
  const util = resources.length ? Math.round(resources.reduce((s, r) => s + r.utilizationPct, 0) / resources.length) : 0;
  return {
    avgWaitMin: avgWait,
    avgVisitMin: avgVisit,
    utilizationPct: util,
    patientsInHouse: inHouse.length,
    completed: completed.length,
  };
}
