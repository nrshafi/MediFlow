import type {
  BottleneckAlert,
  MetricsBlock,
  OperationsSnapshot,
  Patient,
  Recommendation,
  Resource,
} from "@mediflow/shared";
import { asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  allergies,
  diagnoses,
  medications,
  metricSnapshots,
  llmOutputs,
  patients,
  patientTimeline,
  requiredServices,
  resourceQueue,
  resources,
  resourceState,
  simulationState,
  simulationEvents,
  testResults,
  treatments,
} from "../db/schema";
import {
  SimulationInvariantError,
  SimulationNotInitializedError,
} from "../simulation/clock";
import { recommendationSourceHash } from "../llm/service";

const resourceLabel: Record<Resource["type"], string> = {
  doctor: "Consultation",
  lab: "Laboratory",
  xray: "X-Ray",
  ecg: "ECG",
};

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageOneDecimal(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10;
}

export async function getOperationsSnapshot(
  database: Database,
): Promise<OperationsSnapshot> {
  const [state] = await database
    .select()
    .from(simulationState)
    .where(eq(simulationState.id, "current"))
    .limit(1);
  if (!state) throw new SimulationNotInitializedError();
  if (state.speed !== 1 && state.speed !== 4) {
    throw new SimulationInvariantError("Persisted simulation speed is invalid");
  }

  const [
    patientRows,
    resourceRows,
    resourceStateRows,
    queueRows,
    serviceRows,
    timelineRows,
    diagnosisRows,
    medicationRows,
    allergyRows,
    resultRows,
    treatmentRows,
    baselineRows,
    liveMetricRows,
    llmRows,
    clockRows,
  ] = await Promise.all([
    database.select().from(patients).orderBy(asc(patients.id)),
    database.select().from(resources).orderBy(asc(resources.id)),
    database.select().from(resourceState),
    database
      .select()
      .from(resourceQueue)
      .orderBy(asc(resourceQueue.resourceId), asc(resourceQueue.position)),
    database
      .select()
      .from(requiredServices)
      .orderBy(asc(requiredServices.patientId), asc(requiredServices.position)),
    database
      .select()
      .from(patientTimeline)
      .orderBy(asc(patientTimeline.patientId), asc(patientTimeline.position)),
    database.select().from(diagnoses),
    database.select().from(medications),
    database.select().from(allergies),
    database.select().from(testResults),
    database.select().from(treatments),
    database
      .select()
      .from(metricSnapshots)
      .where(eq(metricSnapshots.kind, "baseline"))
      .orderBy(asc(metricSnapshots.simulationMinute)),
    database
      .select()
      .from(metricSnapshots)
      .where(eq(metricSnapshots.kind, "live"))
      .orderBy(asc(metricSnapshots.simulationMinute)),
    database.select().from(llmOutputs).orderBy(asc(llmOutputs.id)),
    database
      .select({ payload: simulationEvents.payload })
      .from(simulationEvents)
      .where(eq(simulationEvents.type, "clock_advanced"))
      .orderBy(desc(simulationEvents.simulationMinute))
      .limit(60),
  ]);

  const queueHistoryByResource = new Map<string, number[]>();
  for (const row of [...clockRows].reverse()) {
    const depths = row.payload?.queueDepths;
    if (!depths || typeof depths !== "object" || Array.isArray(depths)) continue;
    for (const [resourceId, depth] of Object.entries(depths)) {
      if (typeof depth !== "number") continue;
      const history = queueHistoryByResource.get(resourceId) ?? [];
      history.push(depth);
      queueHistoryByResource.set(resourceId, history);
    }
  }

  const resourceStateById = new Map(
    resourceStateRows.map((row) => [row.resourceId, row]),
  );
  const queueByResource = new Map<string, typeof queueRows>();
  const queueResourceByPatient = new Map<string, string>();
  for (const entry of queueRows) {
    const list = queueByResource.get(entry.resourceId) ?? [];
    list.push(entry);
    queueByResource.set(entry.resourceId, list);
    queueResourceByPatient.set(entry.patientId, entry.resourceId);
  }

  const patientById = new Map(patientRows.map((row) => [row.id, row]));
  const durationFor = (resourceId: string, patientId: string): number => {
    const resource = resourceRows.find((row) => row.id === resourceId);
    const patient = patientById.get(patientId);
    if (!resource || !patient) return 0;
    return resource.type === "doctor"
      ? patient.estimatedConsultationDuration
      : resource.serviceDurationMin ?? 0;
  };

  const operationalResources: Resource[] = resourceRows.map((resource) => {
    const mutable = resourceStateById.get(resource.id);
    const queue = (queueByResource.get(resource.id) ?? []).map(
      (entry) => entry.patientId,
    );
    const history = queueHistoryByResource.get(resource.id) ?? [];
    return {
      id: resource.id,
      name: resource.name,
      type: resource.type,
      ...(resource.specialty ? { specialty: resource.specialty } : {}),
      tag: resource.tag,
      status: mutable?.status ?? "available",
      currentPatientId: mutable?.currentPatientId ?? null,
      queue,
      predictedWaitMin: mutable?.predictedWaitMin ?? 0,
      utilizationPct: mutable?.utilizationPct ?? 0,
      queueHistory: [
        ...Array.from({ length: Math.max(0, 60 - history.length) }, () => 0),
        ...history,
      ].slice(-60),
      busyMinutes: mutable?.busyMinutes ?? 0,
    };
  });
  const operationalResourceById = new Map(
    operationalResources.map((resource) => [resource.id, resource]),
  );

  const operationalPatients: Patient[] = patientRows.map((patient) => ({
    id: patient.id,
    token: patient.token,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    arrivalTime: patient.arrivalMinute,
    priority: patient.priority,
    requiredServices: serviceRows
      .filter((service) => service.patientId === patient.id)
      .map((service) => ({
        kind: service.kind,
        ...(service.doctorId ? { doctorId: service.doctorId } : {}),
        done: service.completed,
      })),
    estimatedConsultationDuration: patient.estimatedConsultationDuration,
    currentStage: patient.currentStage,
    queuePosition: patient.queuePosition,
    timeline: timelineRows
      .filter((entry) => entry.patientId === patient.id)
      .map((entry) => ({
        stage: entry.stage,
        start: entry.startedAtMinute,
        end: entry.endedAtMinute,
      })),
    history: {
      diagnoses: diagnosisRows
        .filter((entry) => entry.patientId === patient.id)
        .map(({ condition, year }) => ({ condition, year })),
      medications: medicationRows
        .filter((entry) => entry.patientId === patient.id)
        .map(({ name, dose, frequency }) => ({ name, dose, frequency })),
      allergies: allergyRows
        .filter((entry) => entry.patientId === patient.id)
        .map(({ substance, reaction, severity }) => ({
          substance,
          reaction,
          severity,
        })),
      recentTests: resultRows
        .filter((entry) => entry.patientId === patient.id)
        .map(({ test, value, date, flag }) => ({ test, value, date, flag })),
      treatments: treatmentRows
        .filter((entry) => entry.patientId === patient.id)
        .map(({ procedure, date, note }) => ({ procedure, date, note })),
    },
    serviceEndsAt: patient.serviceEndsAtMinute,
    currentResourceId: patient.currentResourceId,
    completedAt: patient.completedAtMinute,
    waitedMin: patient.waitedMin,
    servedMin: patient.servedMin,
    registered: patient.registered,
  }));

  const recommendations: Record<string, Recommendation> = {};
  for (const patient of operationalPatients) {
    if (!patient.registered || patient.completedAt !== null) continue;
    const targetId =
      patient.currentResourceId ?? queueResourceByPatient.get(patient.id) ?? null;
    const target = targetId ? operationalResourceById.get(targetId) : undefined;
    if (!target) {
      recommendations[patient.id] = {
        patientId: patient.id,
        nextResourceId: null,
        actionText: "Please wait",
        reasonSummary: "Coordinating next step",
        etaMin: 0,
        minutesSaved: 0,
        explanation: "Please wait while MediFlow coordinates your next step.",
      };
      continue;
    }

    let etaMin = patient.currentResourceId
      ? Math.max(0, (patient.serviceEndsAt ?? state.minute) - state.minute)
      : 0;
    if (!patient.currentResourceId) {
      const resourceStateRow = resourceStateById.get(target.id);
      if (resourceStateRow?.currentPatientId) {
        const active = patientById.get(resourceStateRow.currentPatientId);
        etaMin += Math.max(
          0,
          (active?.serviceEndsAtMinute ?? state.minute) - state.minute,
        );
      }
      for (const entry of queueByResource.get(target.id) ?? []) {
        if (entry.patientId === patient.id) break;
        etaMin += durationFor(target.id, entry.patientId);
      }
    }
    const action = patient.currentResourceId ? "Continue at" : "Proceed to";
    const service = resourceLabel[target.type];
    recommendations[patient.id] = {
      patientId: patient.id,
      nextResourceId: target.id,
      actionText: `${action} ${target.name}`,
      reasonSummary: `Next: ${service}`,
      etaMin,
      minutesSaved: 0,
      explanation: patient.currentResourceId
        ? `Your ${service.toLowerCase()} is in progress at ${target.name}.`
        : `Proceed to ${target.name} for your ${service.toLowerCase()}. Your estimated wait is ${etaMin} minutes.`,
    };
  }

  for (const patient of operationalPatients) {
    const recommendation = recommendations[patient.id];
    if (!recommendation) continue;
    const sourceHash = recommendationSourceHash(patient, recommendation);
    const cached = llmRows
      .filter(
        (row) =>
          row.patientId === patient.id &&
          row.kind === "recommendation_explanation" &&
          row.sourceHash === sourceHash,
      )
      .at(-1);
    if (cached) recommendation.explanation = cached.content;
  }

  const alerts: BottleneckAlert[] = operationalResources
    .filter((resource) => resource.status === "congested")
    .map((resource) => ({
      id: `${resource.id}-congested-${state.minute}`,
      resourceId: resource.id,
      severity:
        resource.predictedWaitMin > 35 || resource.queue.length >= 6
          ? "critical"
          : "warning",
      headline: `${resource.name} has a predicted wait of ${resource.predictedWaitMin} minutes.`,
      suggestedAction:
        resource.type === "doctor"
          ? "Route eligible diagnostics before consultation while the doctor queue clears."
          : "Prioritize urgent patients and route other patients to their next available service.",
      detectedAt: state.minute,
    }));

  const arrived = operationalPatients.filter((patient) => patient.registered);
  const completed = arrived.filter((patient) => patient.completedAt !== null);
  const inHouse = arrived.filter((patient) => patient.completedAt === null);
  const live: MetricsBlock = {
    avgWaitMin: average(arrived.map((patient) => patient.waitedMin)),
    avgVisitMin:
      completed.length > 0
        ? average(
            completed.map(
              (patient) => (patient.completedAt ?? state.minute) - patient.arrivalTime,
            ),
          )
        : average(inHouse.map((patient) => state.minute - patient.arrivalTime)),
    utilizationPct:
      liveMetricRows.at(-1)?.utilizationPct ??
      average(operationalResources.map((resource) => resource.utilizationPct)),
    avgQueueDepth:
      liveMetricRows.length > 0
        ? averageOneDecimal(liveMetricRows.map((metric) => metric.avgQueueDepth))
        : operationalResources.reduce(
            (total, resource) => total + resource.queue.length,
            0,
          ),
    peakQueueDepth: Math.max(
      0,
      ...liveMetricRows.map((metric) => metric.peakQueueDepth),
    ),
    patientsInHouse: inHouse.length,
    completed: completed.length,
  };
  const latestBaseline = baselineRows.at(-1);
  const baseline: MetricsBlock = latestBaseline
    ? {
        avgWaitMin: latestBaseline.avgWaitMin,
        avgVisitMin: latestBaseline.avgVisitMin,
        utilizationPct: latestBaseline.utilizationPct,
        avgQueueDepth: latestBaseline.avgQueueDepth,
        peakQueueDepth: latestBaseline.peakQueueDepth,
        patientsInHouse: latestBaseline.patientsInHouse,
        completed: latestBaseline.completed,
      }
    : { ...live };

  return {
    simulation: {
      minute: state.minute,
      playbackStatus: state.playbackStatus,
      speed: state.speed,
      seed: state.seed,
      totalPatients: patientRows.length,
      arrivedPatients: arrived.length,
      completedPatients: completed.length,
    },
    patients: operationalPatients,
    resources: operationalResources,
    recommendations,
    alerts,
    metrics: { live, baseline },
  };
}
