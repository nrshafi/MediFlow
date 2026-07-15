import assert from "node:assert/strict";
import { test } from "node:test";
import {
  planScheduling,
  type SchedulerPatient,
  type SchedulerResource,
  type SchedulerService,
} from "./scheduler";

const resources: SchedulerResource[] = [
  {
    id: "doctor-1",
    type: "doctor",
    serviceDurationMin: null,
    currentPatientId: null,
  },
  {
    id: "lab",
    type: "lab",
    serviceDurationMin: 8,
    currentPatientId: null,
  },
];

function patient(
  id: string,
  priority: SchedulerPatient["priority"] = "normal",
): SchedulerPatient {
  return {
    id,
    arrivalMinute: 0,
    priority,
    estimatedConsultationDuration: 12,
    registered: true,
    currentResourceId: null,
    serviceEndsAtMinute: null,
    completedAtMinute: null,
  };
}

function service(
  patientId: string,
  kind: SchedulerService["kind"],
  position = 0,
): SchedulerService {
  return {
    patientId,
    position,
    kind,
    doctorId: kind === "consultation" ? "doctor-1" : null,
    completed: false,
  };
}

test("chooses the service with the earliest deterministic projected visit completion", () => {
  const input = {
    minute: 5,
    patients: [patient("pat-1")],
    services: [service("pat-1", "consultation"), service("pat-1", "lab", 1)],
    resources,
    queue: [],
  };

  const first = planScheduling(input);
  const second = planScheduling(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first.routes, [
    {
      patientId: "pat-1",
      resourceId: "doctor-1",
      serviceKind: "consultation",
      projectedCompletionMinute: 17,
    },
  ]);
  assert.equal(first.starts[0]?.resourceId, "doctor-1");
  assert.equal(first.starts[0]?.endsAtMinute, 17);
});

test("urgent patients precede normal patients without preempting active work", () => {
  const active = {
    ...patient("pat-active"),
    currentResourceId: "lab",
    serviceEndsAtMinute: 15,
  };
  const plan = planScheduling({
    minute: 10,
    patients: [active, patient("pat-normal"), patient("pat-urgent", "urgent")],
    services: [
      service("pat-active", "lab"),
      service("pat-normal", "lab"),
      service("pat-urgent", "lab"),
    ],
    resources: [{ ...resources[1]!, currentPatientId: "pat-active" }],
    queue: [
      {
        resourceId: "lab",
        patientId: "pat-normal",
        enqueuedAtMinute: 8,
      },
    ],
  });

  const lab = plan.resources[0];
  assert.equal(lab?.currentPatientId, "pat-active");
  assert.deepEqual(
    lab?.queue.map((entry) => entry.patientId),
    ["pat-urgent", "pat-normal"],
  );
});

test("marks a free patient complete after the final required service", () => {
  const doneService = { ...service("pat-1", "lab"), completed: true };
  const plan = planScheduling({
    minute: 20,
    patients: [patient("pat-1")],
    services: [doneService],
    resources,
    queue: [],
  });

  assert.deepEqual(plan.completedPatientIds, ["pat-1"]);
  assert.deepEqual(plan.routes, []);
  assert.deepEqual(plan.starts, []);
});

test("balances interchangeable consultations across simulated doctors", () => {
  const plan = planScheduling({
    minute: 10,
    patients: [
      patient("pat-active"),
      patient("pat-waiting"),
      patient("pat-new"),
    ].map((entry) =>
      entry.id === "pat-active"
        ? { ...entry, currentResourceId: "doctor-1", serviceEndsAtMinute: 20 }
        : entry,
    ),
    services: [
      service("pat-active", "consultation"),
      service("pat-waiting", "consultation"),
      service("pat-new", "consultation"),
    ],
    resources: [
      { ...resources[0]!, currentPatientId: "pat-active" },
      {
        id: "doctor-2",
        type: "doctor",
        serviceDurationMin: null,
        currentPatientId: null,
      },
    ],
    queue: [
      {
        resourceId: "doctor-1",
        patientId: "pat-waiting",
        enqueuedAtMinute: 8,
      },
    ],
  });

  assert.equal(plan.routes[0]?.resourceId, "doctor-2");
  assert.equal(plan.starts[0]?.resourceId, "doctor-2");
});
