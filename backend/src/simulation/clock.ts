import type {
  ServiceKind,
  SimulationStatus,
  SimulationTickEvent,
  SimulationTickResult,
  Stage,
} from "@mediflow/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import {
  patientTimeline,
  patients,
  requiredServices,
  resources,
  resourceState,
  simulationEvents,
  simulationState,
} from "../db/schema";

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
      current.message.includes("UNIQUE constraint failed") ||
      current.message.includes("SQLITE_CONSTRAINT")
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

  const [patientRows, resourceRows] = await Promise.all([
    database
      .select({
        id: patients.id,
        arrivalMinute: patients.arrivalMinute,
        registered: patients.registered,
        currentStage: patients.currentStage,
        currentResourceId: patients.currentResourceId,
        serviceEndsAtMinute: patients.serviceEndsAtMinute,
      })
      .from(patients),
    database.select({ id: resources.id, type: resources.type }).from(resources),
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

  for (const event of plan.events) {
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
    events: plan.events.map(({ payload: _payload, ...event }) => event),
  };
}
