import type {
  ServiceKind,
  SimulationStatus,
  SimulationTickEvent,
  SimulationTickResult,
  Stage,
} from "@mediflow/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import {
  patientTimeline,
  patients,
  requiredServices,
  metricSnapshots,
  resourceQueue,
  resources,
  resourceState,
  simulationEvents,
  simulationState,
} from "../db/schema";
import {
  planScheduling,
  serviceKindForResource,
  type SchedulerPatient,
  type SchedulerResource,
  type SchedulerService,
} from "../engine/scheduler";

type TickPatient = Pick<
  typeof patients.$inferSelect,
  | "id"
  | "arrivalMinute"
  | "registered"
  | "currentStage"
  | "currentResourceId"
  | "serviceEndsAtMinute"
>;

type TickResource = Pick<typeof resources.$inferSelect, "id" | "type">;

interface PlannedCompletion {
  patientId: string;
  resourceId: string | null;
  resourceType: TickResource["type"] | null;
  stage: Stage;
}

interface PlannedArrival {
  arrivalMinute: number;
  patientId: string;
}

interface PlannedEvent extends SimulationTickEvent {
  payload: Record<string, unknown>;
}

export interface SimulationTickPlan {
  nextMinute: number;
  arrivals: PlannedArrival[];
  completions: PlannedCompletion[];
  events: PlannedEvent[];
}

export class SimulationNotInitializedError extends Error {
  constructor() {
    super("Simulation data has not been initialized");
    this.name = "SimulationNotInitializedError";
  }
}

export class SimulationConflictError extends Error {
  constructor() {
    super("The simulation advanced concurrently; retry with the latest state");
    this.name = "SimulationConflictError";
  }
}

export class SimulationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationInvariantError";
  }
}

function eventMinute(minute: number): string {
  return String(minute).padStart(4, "0");
}

export function planSimulationTick(
  currentMinute: number,
  patientRows: readonly TickPatient[],
  resourceRows: readonly TickResource[],
): SimulationTickPlan {
  if (!Number.isInteger(currentMinute) || currentMinute < 0) {
    throw new SimulationInvariantError("Simulation minute must be nonnegative");
  }

  const nextMinute = currentMinute + 1;
  const resourceById = new Map(
    resourceRows.map((resource) => [resource.id, resource]),
  );
  const completions = patientRows
    .filter(
      (patient) =>
        patient.serviceEndsAtMinute !== null &&
        patient.serviceEndsAtMinute <= nextMinute,
    )
    .map((patient): PlannedCompletion => {
      const resource = patient.currentResourceId
        ? resourceById.get(patient.currentResourceId)
        : undefined;
      if (patient.currentResourceId && !resource) {
        throw new SimulationInvariantError(
          `Patient ${patient.id} references an unknown active resource`,
        );
      }
      return {
        patientId: patient.id,
        resourceId: resource?.id ?? null,
        resourceType: resource?.type ?? null,
        stage: patient.currentStage,
      };
    })
    .sort((left, right) => left.patientId.localeCompare(right.patientId));
  const arrivals = patientRows
    .filter(
      (patient) => !patient.registered && patient.arrivalMinute <= nextMinute,
    )
    .map((patient) => ({
      arrivalMinute: patient.arrivalMinute,
      patientId: patient.id,
    }))
    .sort((left, right) => left.patientId.localeCompare(right.patientId));

  const minuteKey = eventMinute(nextMinute);
  const events: PlannedEvent[] = [
    {
      id: `clock-${minuteKey}`,
      simulationMinute: nextMinute,
      orderInMinute: 0,
      type: "clock_advanced",
      patientId: null,
      resourceId: null,
      payload: { fromMinute: currentMinute, toMinute: nextMinute },
    },
  ];
  completions.forEach((completion, index) => {
    events.push({
      id: `service-completed-${minuteKey}-${completion.patientId}`,
      simulationMinute: nextMinute,
      orderInMinute: index + 1,
      type: "service_completed",
      patientId: completion.patientId,
      resourceId: completion.resourceId,
      payload: { stage: completion.stage },
    });
  });
  arrivals.forEach((arrival, index) => {
    events.push({
      id: `patient-arrived-${minuteKey}-${arrival.patientId}`,
      simulationMinute: nextMinute,
      orderInMinute: completions.length + index + 1,
      type: "patient_arrived",
      patientId: arrival.patientId,
      resourceId: null,
      payload: { scheduledArrivalMinute: arrival.arrivalMinute },
    });
  });

  return { nextMinute, arrivals, completions, events };
}

function serviceKindForCompletion(
  completion: PlannedCompletion,
): ServiceKind | null {
  if (completion.resourceType === "doctor") {
    return "consultation";
  }
  if (
    completion.resourceType === "lab" ||
    completion.resourceType === "xray" ||
    completion.resourceType === "ecg"
  ) {
    return completion.resourceType;
  }
  return null;
}

function isConstraintConflict(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (
      current.message.includes("UNIQUE constraint failed") &&
      (current.message.includes("simulation_events") ||
        current.message.includes("metric_snapshots"))
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export async function getSimulationStatus(
  database: Database,
): Promise<SimulationStatus> {
  const [state] = await database
    .select()
    .from(simulationState)
    .where(eq(simulationState.id, "current"))
    .limit(1);
  if (!state) {
    throw new SimulationNotInitializedError();
  }
  if (state.speed !== 1 && state.speed !== 4) {
    throw new SimulationInvariantError("Persisted simulation speed is invalid");
  }

  const patientRows = await database
    .select({
      completedAtMinute: patients.completedAtMinute,
      registered: patients.registered,
    })
    .from(patients);

  return {
    minute: state.minute,
    playbackStatus: state.playbackStatus,
    speed: state.speed,
    seed: state.seed,
    totalPatients: patientRows.length,
    arrivedPatients: patientRows.filter((patient) => patient.registered).length,
    completedPatients: patientRows.filter(
      (patient) => patient.completedAtMinute !== null,
    ).length,
  };
}

export async function advanceSimulation(
  database: Database,
): Promise<SimulationTickResult> {
  const [state] = await database
    .select()
    .from(simulationState)
    .where(eq(simulationState.id, "current"))
    .limit(1);
  if (!state) {
    throw new SimulationNotInitializedError();
  }

  const [patientRows, resourceRows, stateRows, serviceRows, queueRows, timelineRows] = await Promise.all([
    database
      .select({
        id: patients.id,
        arrivalMinute: patients.arrivalMinute,
        priority: patients.priority,
        estimatedConsultationDuration: patients.estimatedConsultationDuration,
        registered: patients.registered,
        currentStage: patients.currentStage,
        currentResourceId: patients.currentResourceId,
        serviceEndsAtMinute: patients.serviceEndsAtMinute,
        completedAtMinute: patients.completedAtMinute,
        waitedMin: patients.waitedMin,
        servedMin: patients.servedMin,
      })
      .from(patients),
    database
      .select({
        id: resources.id,
        type: resources.type,
        serviceDurationMin: resources.serviceDurationMin,
      })
      .from(resources),
    database.select().from(resourceState),
    database.select().from(requiredServices),
    database.select().from(resourceQueue),
    database
      .select({ patientId: patientTimeline.patientId, position: patientTimeline.position })
      .from(patientTimeline),
  ]);
  const plan = planSimulationTick(state.minute, patientRows, resourceRows);
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    database
      .update(simulationState)
      .set({ minute: plan.nextMinute, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(simulationState.id, "current"),
          eq(simulationState.minute, state.minute),
        ),
      ),
  ];

  const queuedAtStart = [...new Set(queueRows.map((entry) => entry.patientId))];
  if (queuedAtStart.length > 0) {
    statements.push(
      database
        .update(patients)
        .set({ waitedMin: sql`${patients.waitedMin} + 1` })
        .where(inArray(patients.id, queuedAtStart)),
    );
  }
  const activeAtStart = patientRows
    .filter((patient) => patient.currentResourceId !== null)
    .map((patient) => patient.id);
  if (activeAtStart.length > 0) {
    statements.push(
      database
        .update(patients)
        .set({ servedMin: sql`${patients.servedMin} + 1` })
        .where(inArray(patients.id, activeAtStart)),
    );
  }
  for (const resource of stateRows) {
    if (resource.currentPatientId) {
      statements.push(
        database
          .update(resourceState)
          .set({ busyMinutes: sql`${resourceState.busyMinutes} + 1` })
          .where(eq(resourceState.resourceId, resource.resourceId)),
      );
    }
  }

  for (const completion of plan.completions) {
    statements.push(
      database
        .update(patients)
        .set({ currentResourceId: null, serviceEndsAtMinute: null })
        .where(eq(patients.id, completion.patientId)),
      database
        .update(patientTimeline)
        .set({ endedAtMinute: plan.nextMinute })
        .where(
          and(
            eq(patientTimeline.patientId, completion.patientId),
            eq(patientTimeline.stage, completion.stage),
            isNull(patientTimeline.endedAtMinute),
          ),
        ),
    );
    if (completion.resourceId) {
      statements.push(
        database
          .update(resourceState)
          .set({
            currentPatientId: null,
            status: "available",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(resourceState.resourceId, completion.resourceId),
              eq(resourceState.currentPatientId, completion.patientId),
            ),
          ),
      );
    }
    const serviceKind = serviceKindForCompletion(completion);
    if (serviceKind) {
      if (serviceKind === "consultation") {
        const doctorId = completion.resourceId;
        if (!doctorId) {
          throw new SimulationInvariantError(
            `Patient ${completion.patientId} has a doctor completion without a resource`,
          );
        }
        statements.push(
          database
            .update(requiredServices)
            .set({ completed: true })
            .where(
              and(
                eq(requiredServices.patientId, completion.patientId),
                eq(requiredServices.kind, serviceKind),
                eq(requiredServices.doctorId, doctorId),
              ),
            ),
        );
      } else {
        statements.push(
          database
            .update(requiredServices)
            .set({ completed: true })
            .where(
              and(
                eq(requiredServices.patientId, completion.patientId),
                eq(requiredServices.kind, serviceKind),
              ),
            ),
        );
      }
    }
  }

  for (const arrival of plan.arrivals) {
    statements.push(
      database
        .update(patients)
        .set({ registered: true })
        .where(
          and(
            eq(patients.id, arrival.patientId),
            eq(patients.registered, false),
          ),
        ),
      database
        .update(patientTimeline)
        .set({
          startedAtMinute: arrival.arrivalMinute,
          endedAtMinute: arrival.arrivalMinute,
        })
        .where(
          and(
            eq(patientTimeline.patientId, arrival.patientId),
            eq(patientTimeline.stage, "registration"),
          ),
        ),
    );
  }

  const completionKindByPatient = new Map<string, ServiceKind>();
  for (const completion of plan.completions) {
    const kind = serviceKindForCompletion(completion);
    if (kind) completionKindByPatient.set(completion.patientId, kind);
  }
  const arrivingIds = new Set(plan.arrivals.map((arrival) => arrival.patientId));
  const completingIds = new Set(
    plan.completions.map((completion) => completion.patientId),
  );
  const effectivePatients: SchedulerPatient[] = patientRows.map((patient) => ({
    id: patient.id,
    arrivalMinute: patient.arrivalMinute,
    priority: patient.priority,
    estimatedConsultationDuration: patient.estimatedConsultationDuration,
    registered: patient.registered || arrivingIds.has(patient.id),
    currentResourceId: completingIds.has(patient.id)
      ? null
      : patient.currentResourceId,
    serviceEndsAtMinute: completingIds.has(patient.id)
      ? null
      : patient.serviceEndsAtMinute,
    completedAtMinute: patient.completedAtMinute,
  }));
  const effectiveServices: SchedulerService[] = serviceRows.map((service) => ({
    patientId: service.patientId,
    position: service.position,
    kind: service.kind,
    doctorId: service.doctorId,
    completed:
      service.completed ||
      completionKindByPatient.get(service.patientId) === service.kind,
  }));
  const stateByResource = new Map(
    stateRows.map((resource) => [resource.resourceId, resource]),
  );
  const effectiveResources: SchedulerResource[] = resourceRows.map((resource) => {
    const persisted = stateByResource.get(resource.id);
    const completedOnResource = plan.completions.some(
      (completion) => completion.resourceId === resource.id,
    );
    return {
      id: resource.id,
      type: resource.type,
      serviceDurationMin: resource.serviceDurationMin,
      currentPatientId: completedOnResource
        ? null
        : persisted?.currentPatientId ?? null,
    };
  });
  const scheduling = planScheduling({
    minute: plan.nextMinute,
    patients: effectivePatients,
    services: effectiveServices,
    resources: effectiveResources,
    queue: queueRows.map((entry) => ({
      resourceId: entry.resourceId,
      patientId: entry.patientId,
      enqueuedAtMinute: entry.enqueuedAtMinute,
    })),
  });
  const clockEvent = plan.events[0];
  if (clockEvent) {
    clockEvent.payload = {
      ...clockEvent.payload,
      queueDepths: Object.fromEntries(
        scheduling.resources.map((resource) => [
          resource.resourceId,
          resource.queue.length + (resource.currentPatientId ? 1 : 0),
        ]),
      ),
    };
  }

  for (const route of scheduling.routes) {
    if (route.serviceKind === "consultation") {
      statements.push(
        database
          .update(requiredServices)
          .set({ doctorId: route.resourceId })
          .where(
            and(
              eq(requiredServices.patientId, route.patientId),
              eq(requiredServices.kind, "consultation"),
              eq(requiredServices.completed, false),
            ),
          ),
      );
    }
  }

  statements.push(database.delete(resourceQueue));
  for (const resource of scheduling.resources) {
    for (const [index, entry] of resource.queue.entries()) {
      statements.push(
        database.insert(resourceQueue).values({
          resourceId: resource.resourceId,
          patientId: entry.patientId,
          position: index + 1,
          enqueuedAtMinute: entry.enqueuedAtMinute,
        }),
      );
      const resourceDefinition = resourceRows.find(
        (candidate) => candidate.id === resource.resourceId,
      );
      if (!resourceDefinition) {
        throw new SimulationInvariantError("Scheduled resource is missing");
      }
      statements.push(
        database
          .update(patients)
          .set({
            currentStage:
              resourceDefinition.type === "doctor"
                ? "consultation"
                : resourceDefinition.type,
            currentResourceId: null,
            serviceEndsAtMinute: null,
            queuePosition: index + 1,
          })
          .where(eq(patients.id, entry.patientId)),
      );
    }
    const persisted = stateByResource.get(resource.resourceId);
    const busyMinutes =
      (persisted?.busyMinutes ?? 0) + (persisted?.currentPatientId ? 1 : 0);
    const utilizationPct = Math.min(
      100,
      Math.round((busyMinutes / Math.max(1, plan.nextMinute)) * 100),
    );
    statements.push(
      database
        .update(resourceState)
        .set({
          currentPatientId: resource.currentPatientId,
          status: resource.status,
          predictedWaitMin: resource.predictedWaitMin,
          utilizationPct,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(resourceState.resourceId, resource.resourceId)),
    );
  }

  const nextTimelinePosition = new Map<string, number>();
  for (const row of timelineRows) {
    nextTimelinePosition.set(
      row.patientId,
      Math.max(nextTimelinePosition.get(row.patientId) ?? 0, row.position + 1),
    );
  }
  for (const start of scheduling.starts) {
    const resource = resourceRows.find(
      (candidate) => candidate.id === start.resourceId,
    );
    if (!resource) throw new SimulationInvariantError("Start resource is missing");
    statements.push(
      database
        .update(patients)
        .set({
          currentStage:
            resource.type === "doctor" ? "consultation" : resource.type,
          currentResourceId: start.resourceId,
          serviceEndsAtMinute: start.endsAtMinute,
          queuePosition: 0,
        })
        .where(eq(patients.id, start.patientId)),
      database.insert(patientTimeline).values({
        patientId: start.patientId,
        position: nextTimelinePosition.get(start.patientId) ?? 0,
        stage: resource.type === "doctor" ? "consultation" : resource.type,
        startedAtMinute: start.startsAtMinute,
      }),
    );
  }
  for (const patientId of scheduling.completedPatientIds) {
    statements.push(
      database
        .update(patients)
        .set({
          currentStage: "done",
          completedAtMinute: plan.nextMinute,
          queuePosition: 0,
        })
        .where(eq(patients.id, patientId)),
      database.insert(patientTimeline).values({
        patientId,
        position: nextTimelinePosition.get(patientId) ?? 0,
        stage: "done",
        startedAtMinute: plan.nextMinute,
        endedAtMinute: plan.nextMinute,
      }),
    );
  }

  let nextOrder = plan.events.length;
  const schedulingEvents: PlannedEvent[] = [];
  for (const route of scheduling.routes) {
    schedulingEvents.push({
      id: `patient-queued-${eventMinute(plan.nextMinute)}-${route.patientId}`,
      simulationMinute: plan.nextMinute,
      orderInMinute: nextOrder++,
      type: "patient_queued",
      patientId: route.patientId,
      resourceId: route.resourceId,
      payload: {
        serviceKind: route.serviceKind,
        projectedCompletionMinute: route.projectedCompletionMinute,
      },
    });
  }
  for (const start of scheduling.starts) {
    schedulingEvents.push({
      id: `service-started-${eventMinute(plan.nextMinute)}-${start.patientId}`,
      simulationMinute: plan.nextMinute,
      orderInMinute: nextOrder++,
      type: "service_started",
      patientId: start.patientId,
      resourceId: start.resourceId,
      payload: {
        serviceKind: start.serviceKind,
        endsAtMinute: start.endsAtMinute,
      },
    });
  }
  for (const route of scheduling.routes) {
    schedulingEvents.push({
      id: `recommendation-${eventMinute(plan.nextMinute)}-${route.patientId}`,
      simulationMinute: plan.nextMinute,
      orderInMinute: nextOrder++,
      type: "recommendation_created",
      patientId: route.patientId,
      resourceId: route.resourceId,
      payload: {
        serviceKind: route.serviceKind,
        projectedCompletionMinute: route.projectedCompletionMinute,
      },
    });
  }

  const queuedAtStartSet = new Set(queuedAtStart);
  const activeAtStartSet = new Set(activeAtStart);
  const completedNow = new Set(scheduling.completedPatientIds);
  const metricPatients = patientRows.map((patient) => ({
    arrivalMinute: patient.arrivalMinute,
    registered: patient.registered || arrivingIds.has(patient.id),
    completedAtMinute:
      patient.completedAtMinute ??
      (completedNow.has(patient.id) ? plan.nextMinute : null),
    waitedMin: patient.waitedMin + (queuedAtStartSet.has(patient.id) ? 1 : 0),
    servedMin: patient.servedMin + (activeAtStartSet.has(patient.id) ? 1 : 0),
  }));
  const arrivedForMetrics = metricPatients.filter((patient) => patient.registered);
  const completedForMetrics = arrivedForMetrics.filter(
    (patient) => patient.completedAtMinute !== null,
  );
  const inHouseForMetrics = arrivedForMetrics.filter(
    (patient) => patient.completedAtMinute === null,
  );
  const average = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const utilizationValues = scheduling.resources.map((resource) => {
    const persisted = stateByResource.get(resource.resourceId);
    const busyMinutes =
      (persisted?.busyMinutes ?? 0) + (persisted?.currentPatientId ? 1 : 0);
    return Math.min(
      100,
      (busyMinutes / Math.max(1, plan.nextMinute)) * 100,
    );
  });
  const currentQueueDepth = scheduling.resources.reduce(
    (total, resource) => total + resource.queue.length,
    0,
  );
  statements.push(
    database.insert(metricSnapshots).values({
      simulationMinute: plan.nextMinute,
      kind: "live",
      avgWaitMin: average(
        arrivedForMetrics.map((patient) => patient.waitedMin),
      ),
      avgVisitMin:
        completedForMetrics.length > 0
          ? average(
              completedForMetrics.map(
                (patient) =>
                  Math.max(
                    0,
                    (patient.completedAtMinute ?? plan.nextMinute) -
                      patient.arrivalMinute,
                  ),
              ),
            )
          : average(
              inHouseForMetrics.map(
                (patient) =>
                  Math.max(0, plan.nextMinute - patient.arrivalMinute),
              ),
            ),
      utilizationPct:
        Math.round(
          (utilizationValues.reduce((sum, value) => sum + value, 0) /
            Math.max(1, utilizationValues.length)) *
            10,
        ) / 10,
      avgQueueDepth: currentQueueDepth,
      peakQueueDepth: currentQueueDepth,
      patientsInHouse: inHouseForMetrics.length,
      completed: completedForMetrics.length,
    }),
  );

  const allEvents = [...plan.events, ...schedulingEvents];
  for (const event of allEvents) {
    statements.push(
      database.insert(simulationEvents).values({
        id: event.id,
        simulationMinute: event.simulationMinute,
        orderInMinute: event.orderInMinute,
        type: event.type,
        patientId: event.patientId,
        resourceId: event.resourceId,
        payload: event.payload,
      }),
    );
  }

  try {
    await database.batch(statements);
  } catch (error) {
    if (isConstraintConflict(error)) {
      throw new SimulationConflictError();
    }
    throw error;
  }

  return {
    state: await getSimulationStatus(database),
    events: allEvents.map(({ payload: _payload, ...event }) => event),
  };
}
