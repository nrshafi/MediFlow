import assert from "node:assert/strict";
import { test } from "node:test";
import { computeNaiveFifoBaseline } from "./baseline";

test("computes a deterministic FIFO baseline across shared resources", () => {
  const input = {
    patients: [
      { id: "pat-1", arrivalMinute: 0, estimatedConsultationDuration: 10 },
      { id: "pat-2", arrivalMinute: 1, estimatedConsultationDuration: 10 },
    ],
    services: [
      { patientId: "pat-1", position: 0, kind: "lab" as const, doctorId: null },
      {
        patientId: "pat-1",
        position: 1,
        kind: "consultation" as const,
        doctorId: "doctor",
      },
      { patientId: "pat-2", position: 0, kind: "lab" as const, doctorId: null },
      {
        patientId: "pat-2",
        position: 1,
        kind: "consultation" as const,
        doctorId: "doctor",
      },
    ],
    resources: [
      { id: "lab", type: "lab" as const, serviceDurationMin: 5 },
      { id: "doctor", type: "doctor" as const, serviceDurationMin: null },
    ],
  };

  const first = computeNaiveFifoBaseline(input);
  assert.deepEqual(first, computeNaiveFifoBaseline(input));
  assert.deepEqual(first, {
    avgWaitMin: 5,
    avgVisitMin: 20,
    utilizationPct: 60,
    avgQueueDepth: 0.4,
    peakQueueDepth: 1,
    patientsInHouse: 0,
    completed: 2,
  });
});
