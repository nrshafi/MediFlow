import type { MetricsBlock, ResourceType, ServiceKind } from "@mediflow/shared";

export interface BaselinePatient {
  id: string;
  arrivalMinute: number;
  estimatedConsultationDuration: number;
}

export interface BaselineService {
  patientId: string;
  position: number;
  kind: ServiceKind;
  doctorId: string | null;
}

export interface BaselineResource {
  id: string;
  type: ResourceType;
  serviceDurationMin: number | null;
}

interface PendingRequest {
  patientId: string;
  readyMinute: number;
  serviceIndex: number;
}

interface ScheduledRequest {
  readyMinute: number;
  startsAtMinute: number;
}

export function computeNaiveFifoBaseline(input: {
  patients: readonly BaselinePatient[];
  services: readonly BaselineService[];
  resources: readonly BaselineResource[];
}): MetricsBlock {
  const servicesByPatient = new Map<string, BaselineService[]>();
  for (const service of input.services) {
    const list = servicesByPatient.get(service.patientId) ?? [];
    list.push(service);
    servicesByPatient.set(service.patientId, list);
  }
  for (const list of servicesByPatient.values()) {
    const canonicalOrder: Record<ServiceKind, number> = {
      lab: 0,
      xray: 1,
      ecg: 2,
      consultation: 3,
    };
    list.sort(
      (left, right) =>
        canonicalOrder[left.kind] - canonicalOrder[right.kind] ||
        left.position - right.position,
    );
  }
  const patientById = new Map(input.patients.map((patient) => [patient.id, patient]));
  const resourceById = new Map(input.resources.map((resource) => [resource.id, resource]));
  const diagnosticResource = new Map(
    input.resources
      .filter((resource) => resource.type !== "doctor")
      .map((resource) => [resource.type, resource]),
  );
  const resourceFreeAt = new Map(input.resources.map((resource) => [resource.id, 0]));
  const busyMinutes = new Map(input.resources.map((resource) => [resource.id, 0]));
  const waitedByPatient = new Map(input.patients.map((patient) => [patient.id, 0]));
  const completedAt = new Map<string, number>();
  const scheduledRequests: ScheduledRequest[] = [];
  const pending: PendingRequest[] = input.patients.map((patient) => ({
    patientId: patient.id,
    readyMinute: patient.arrivalMinute,
    serviceIndex: 0,
  }));

  while (pending.length > 0) {
    pending.sort(
      (left, right) =>
        left.readyMinute - right.readyMinute ||
        left.patientId.localeCompare(right.patientId),
    );
    const request = pending.shift();
    if (!request) break;
    const patient = patientById.get(request.patientId);
    const patientServices = servicesByPatient.get(request.patientId) ?? [];
    const service = patientServices[request.serviceIndex];
    if (!patient || !service) {
      completedAt.set(request.patientId, request.readyMinute);
      continue;
    }
    const resource =
      service.kind === "consultation"
        ? resourceById.get(service.doctorId ?? "")
        : diagnosticResource.get(service.kind);
    if (!resource) {
      throw new Error(
        `Naive baseline cannot find ${service.kind} for ${request.patientId}`,
      );
    }
    const duration =
      resource.type === "doctor"
        ? patient.estimatedConsultationDuration
        : resource.serviceDurationMin;
    if (duration === null || duration <= 0) {
      throw new Error(`Naive baseline resource ${resource.id} has no duration`);
    }
    const startsAt = Math.max(
      request.readyMinute,
      resourceFreeAt.get(resource.id) ?? 0,
    );
    const endsAt = startsAt + duration;
    scheduledRequests.push({ readyMinute: request.readyMinute, startsAtMinute: startsAt });
    waitedByPatient.set(
      patient.id,
      (waitedByPatient.get(patient.id) ?? 0) + startsAt - request.readyMinute,
    );
    resourceFreeAt.set(resource.id, endsAt);
    busyMinutes.set(resource.id, (busyMinutes.get(resource.id) ?? 0) + duration);
    if (request.serviceIndex + 1 < patientServices.length) {
      pending.push({
        patientId: patient.id,
        readyMinute: endsAt,
        serviceIndex: request.serviceIndex + 1,
      });
    } else {
      completedAt.set(patient.id, endsAt);
    }
  }

  const average = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const averageOneDecimal = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : Math.round(
          (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
        ) / 10;
  const finishMinute = Math.max(1, ...completedAt.values());
  const queueDepths = Array.from({ length: finishMinute }, (_, minute) =>
    scheduledRequests.reduce(
      (depth, request) =>
        depth +
        (request.readyMinute <= minute && request.startsAtMinute > minute ? 1 : 0),
      0,
    ),
  );
  return {
    avgWaitMin: average([...waitedByPatient.values()]),
    avgVisitMin: average(
      input.patients.map(
        (patient) =>
          (completedAt.get(patient.id) ?? patient.arrivalMinute) -
          patient.arrivalMinute,
      ),
    ),
    utilizationPct:
      Math.round(
        (input.resources.reduce(
          (total, resource) => total + (busyMinutes.get(resource.id) ?? 0),
          0,
        ) /
          (input.resources.length * finishMinute)) *
          1_000,
      ) / 10,
    avgQueueDepth: averageOneDecimal(queueDepths),
    peakQueueDepth: Math.max(0, ...queueDepths),
    patientsInHouse: 0,
    completed: input.patients.length,
  };
}
