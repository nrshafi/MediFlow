import type {
  Priority,
  ResourceStatus,
  ResourceType,
  ServiceKind,
  Stage,
} from "@mediflow/shared";

export interface SchedulerPatient {
  id: string;
  arrivalMinute: number;
  priority: Priority;
  estimatedConsultationDuration: number;
  registered: boolean;
  currentResourceId: string | null;
  serviceEndsAtMinute: number | null;
  completedAtMinute: number | null;
}

export interface SchedulerService {
  patientId: string;
  position: number;
  kind: ServiceKind;
  doctorId: string | null;
  completed: boolean;
}

export interface SchedulerResource {
  id: string;
  type: ResourceType;
  serviceDurationMin: number | null;
  currentPatientId: string | null;
}

export interface SchedulerQueueEntry {
  resourceId: string;
  patientId: string;
  enqueuedAtMinute: number;
}

export interface PlannedRoute {
  patientId: string;
  resourceId: string;
  serviceKind: ServiceKind;
  projectedCompletionMinute: number;
}

export interface PlannedServiceStart {
  patientId: string;
  resourceId: string;
  serviceKind: ServiceKind;
  startsAtMinute: number;
  endsAtMinute: number;
}

export interface PlannedResourceState {
  resourceId: string;
  currentPatientId: string | null;
  status: ResourceStatus;
  predictedWaitMin: number;
  queue: SchedulerQueueEntry[];
}

export interface SchedulingPlan {
  routes: PlannedRoute[];
  starts: PlannedServiceStart[];
  completedPatientIds: string[];
  resources: PlannedResourceState[];
  queuePositionByPatient: ReadonlyMap<string, number>;
}

export class SchedulingInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingInvariantError";
  }
}

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  normal: 1,
};

function stageForResource(type: ResourceType): Stage {
  return type === "doctor" ? "consultation" : type;
}

export function serviceKindForResource(type: ResourceType): ServiceKind {
  return stageForResource(type) as ServiceKind;
}

function queueComparator(
  patients: ReadonlyMap<string, SchedulerPatient>,
): (left: SchedulerQueueEntry, right: SchedulerQueueEntry) => number {
  return (left, right) => {
    const leftPatient = patients.get(left.patientId);
    const rightPatient = patients.get(right.patientId);
    if (!leftPatient || !rightPatient) {
      throw new SchedulingInvariantError("A queue references an unknown patient");
    }
    return (
      priorityRank[leftPatient.priority] - priorityRank[rightPatient.priority] ||
      left.enqueuedAtMinute - right.enqueuedAtMinute ||
      left.patientId.localeCompare(right.patientId)
    );
  };
}

function durationFor(
  resource: SchedulerResource,
  patient: SchedulerPatient,
): number {
  const duration =
    resource.type === "doctor"
      ? patient.estimatedConsultationDuration
      : resource.serviceDurationMin;
  if (duration === null || !Number.isInteger(duration) || duration <= 0) {
    throw new SchedulingInvariantError(
      `Resource ${resource.id} has no valid service duration`,
    );
  }
  return duration;
}

function resourceForService(
  service: SchedulerService,
  resources: readonly SchedulerResource[],
): SchedulerResource | undefined {
  if (service.kind === "consultation") {
    return resources.find((resource) => resource.id === service.doctorId);
  }
  return resources.find((resource) => resource.type === service.kind);
}

export function planScheduling(input: {
  minute: number;
  patients: readonly SchedulerPatient[];
  services: readonly SchedulerService[];
  resources: readonly SchedulerResource[];
  queue: readonly SchedulerQueueEntry[];
}): SchedulingPlan {
  const { minute, patients, services, resources, queue } = input;
  if (!Number.isInteger(minute) || minute < 0) {
    throw new SchedulingInvariantError("Scheduling minute must be nonnegative");
  }

  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const resourceById = new Map(
    resources.map((resource) => [resource.id, resource]),
  );
  const servicesByPatient = new Map<string, SchedulerService[]>();
  for (const service of services) {
    const list = servicesByPatient.get(service.patientId) ?? [];
    list.push(service);
    servicesByPatient.set(service.patientId, list);
  }

  const queues = new Map<string, SchedulerQueueEntry[]>();
  for (const resource of resources) queues.set(resource.id, []);
  for (const entry of queue) {
    if (!resourceById.has(entry.resourceId) || !patientById.has(entry.patientId)) {
      throw new SchedulingInvariantError("A queue entry references unknown state");
    }
    queues.get(entry.resourceId)?.push({ ...entry });
  }
  const compareQueue = queueComparator(patientById);
  for (const entries of queues.values()) entries.sort(compareQueue);

  const queuedPatients = new Set(queue.map((entry) => entry.patientId));
  if (queuedPatients.size !== queue.length) {
    throw new SchedulingInvariantError(
      "A patient cannot wait in more than one resource queue",
    );
  }

  const completedPatientIds: string[] = [];
  const routes: PlannedRoute[] = [];
  const eligible = patients
    .filter(
      (patient) =>
        patient.registered &&
        patient.completedAtMinute === null &&
        patient.currentResourceId === null &&
        !queuedPatients.has(patient.id),
    )
    .sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        left.arrivalMinute - right.arrivalMinute ||
        left.id.localeCompare(right.id),
    );

  for (const patient of eligible) {
    const remaining = (servicesByPatient.get(patient.id) ?? [])
      .filter((service) => !service.completed)
      .sort(
        (left, right) =>
          left.position - right.position || left.kind.localeCompare(right.kind),
      );
    if (remaining.length === 0) {
      completedPatientIds.push(patient.id);
      continue;
    }

    let best:
      | {
          service: SchedulerService;
          resource: SchedulerResource;
          completionMinute: number;
          visitCompletionMinute: number;
        }
      | undefined;
    const remainingServiceDuration = remaining.reduce((total, candidate) => {
      const candidateResource = resourceForService(candidate, resources);
      if (!candidateResource) {
        throw new SchedulingInvariantError(
          `No resource can provide ${candidate.kind} for patient ${patient.id}`,
        );
      }
      return total + durationFor(candidateResource, patient);
    }, 0);
    for (const service of remaining) {
      const candidateResources =
        service.kind === "consultation"
          ? resources.filter((resource) => resource.type === "doctor")
          : [resourceForService(service, resources)].filter(
              (resource): resource is SchedulerResource => Boolean(resource),
            );
      if (candidateResources.length === 0) {
        throw new SchedulingInvariantError(
          `No resource can provide ${service.kind} for patient ${patient.id}`,
        );
      }
      for (const resource of candidateResources) {
        const candidate: SchedulerQueueEntry = {
          resourceId: resource.id,
          patientId: patient.id,
          enqueuedAtMinute: minute,
        };
        const ordered = [...(queues.get(resource.id) ?? []), candidate].sort(
          compareQueue,
        );
        const candidateIndex = ordered.findIndex(
          (entry) => entry.patientId === patient.id,
        );
        let workBefore = resource.currentPatientId
          ? Math.max(
              0,
              (patientById.get(resource.currentPatientId)?.serviceEndsAtMinute ??
                minute) - minute,
            )
          : 0;
        for (const entry of ordered.slice(0, candidateIndex)) {
          const queuedPatient = patientById.get(entry.patientId);
          if (!queuedPatient) {
            throw new SchedulingInvariantError("Queue patient disappeared");
          }
          workBefore += durationFor(resource, queuedPatient);
        }
        const completionMinute =
          minute + workBefore + durationFor(resource, patient);
        const visitCompletionMinute =
          minute + workBefore + remainingServiceDuration;
        if (
          !best ||
          visitCompletionMinute < best.visitCompletionMinute ||
          (visitCompletionMinute === best.visitCompletionMinute &&
            (service.position < best.service.position ||
              (service.position === best.service.position &&
                resource.id.localeCompare(best.resource.id) < 0)))
        ) {
          best = { service, resource, completionMinute, visitCompletionMinute };
        }
      }
    }
    if (!best) continue;
    const entry: SchedulerQueueEntry = {
      resourceId: best.resource.id,
      patientId: patient.id,
      enqueuedAtMinute: minute,
    };
    queues.get(best.resource.id)?.push(entry);
    queues.get(best.resource.id)?.sort(compareQueue);
    queuedPatients.add(patient.id);
    routes.push({
      patientId: patient.id,
      resourceId: best.resource.id,
      serviceKind: best.service.kind,
      projectedCompletionMinute: best.completionMinute,
    });
  }

  const starts: PlannedServiceStart[] = [];
  const plannedResources: PlannedResourceState[] = [];
  const queuePositionByPatient = new Map<string, number>();
  for (const resource of [...resources].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const entries = queues.get(resource.id) ?? [];
    let currentPatientId = resource.currentPatientId;
    let activeEndsAt = currentPatientId
      ? patientById.get(currentPatientId)?.serviceEndsAtMinute ?? minute
      : minute;
    if (!currentPatientId && entries.length > 0) {
      const next = entries.shift();
      if (!next) throw new SchedulingInvariantError("Queue head disappeared");
      const patient = patientById.get(next.patientId);
      if (!patient) throw new SchedulingInvariantError("Queue patient disappeared");
      const duration = durationFor(resource, patient);
      currentPatientId = patient.id;
      activeEndsAt = minute + duration;
      starts.push({
        patientId: patient.id,
        resourceId: resource.id,
        serviceKind: serviceKindForResource(resource.type),
        startsAtMinute: minute,
        endsAtMinute: activeEndsAt,
      });
    }
    entries.forEach((entry, index) => {
      queuePositionByPatient.set(entry.patientId, index + 1);
    });
    let predictedWaitMin = currentPatientId
      ? Math.max(0, activeEndsAt - minute)
      : 0;
    for (const entry of entries) {
      const patient = patientById.get(entry.patientId);
      if (!patient) throw new SchedulingInvariantError("Queue patient disappeared");
      predictedWaitMin += durationFor(resource, patient);
    }
    const status: ResourceStatus =
      entries.length >= 4 || predictedWaitMin > 25
        ? "congested"
        : currentPatientId
          ? "busy"
          : "available";
    plannedResources.push({
      resourceId: resource.id,
      currentPatientId,
      status,
      predictedWaitMin,
      queue: entries,
    });
  }

  return {
    routes,
    starts,
    completedPatientIds: completedPatientIds.sort(),
    resources: plannedResources,
    queuePositionByPatient,
  };
}
