import { createClient } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Database } from "./client";
import {
  buildSeedData,
  CANONICAL_SEED,
  resetAndSeedDatabase,
  SEEDED_PATIENT_COUNT,
} from "./seed";
import {
  diagnoses,
  medications,
  patients,
  requiredServices,
  resources,
  resourceState,
  simulationEvents,
  simulationState,
  testResults,
} from "./schema";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

test("the canonical fixture is deterministic and satisfies MVP bounds", () => {
  const first = buildSeedData();
  const second = buildSeedData();

  assert.deepEqual(first, second);
  assert.equal(first.resources.length, 6);
  assert.equal(
    first.resources.filter((resource) => resource.type === "doctor").length,
    3,
  );
  assert.equal(
    first.resources.filter((resource) => resource.type === "lab").length,
    1,
  );
  assert.equal(
    first.resources.filter((resource) => resource.type === "xray").length,
    1,
  );
  assert.equal(
    first.resources.filter((resource) => resource.type === "ecg").length,
    1,
  );
  assert.equal(first.patients.length, SEEDED_PATIENT_COUNT);
  assert.ok(first.patients.length >= 20 && first.patients.length <= 50);
  assert.deepEqual(
    first.patients.map((patient) => patient.arrivalMinute),
    [...first.patients]
      .map((patient) => patient.arrivalMinute)
      .sort((left, right) => left - right),
  );
  assert.equal(
    new Set(first.patients.map((patient) => patient.token)).size,
    first.patients.length,
  );
  assert.ok(first.allergies.length > 0);
  assert.ok(first.treatments.length > 0);

  for (const patient of first.patients) {
    const services = first.requiredServices.filter(
      (service) => service.patientId === patient.id,
    );
    const consultations = services.filter(
      (service) => service.kind === "consultation",
    );
    assert.equal(consultations.length, 1);
    assert.ok(consultations[0]?.doctorId?.startsWith("dr-"));
    assert.ok(services.length >= 1 && services.length <= 3);
    assert.ok(
      first.diagnoses.some((diagnosis) => diagnosis.patientId === patient.id),
    );
    assert.ok(
      first.medications.some(
        (medication) => medication.patientId === patient.id,
      ),
    );
    assert.ok(
      first.testResults.some((result) => result.patientId === patient.id),
    );
  }
});

test("migrations and deterministic reset-seeding work against SQLite", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await resetAndSeedDatabase(database);

    const [resourceCount] = await database
      .select({ value: count() })
      .from(resources);
    const [patientCount] = await database
      .select({ value: count() })
      .from(patients);
    const [stateCount] = await database
      .select({ value: count() })
      .from(resourceState);
    const [consultationCount] = await database
      .select({ value: count() })
      .from(requiredServices)
      .where(eq(requiredServices.kind, "consultation"));
    const [diagnosisCount] = await database
      .select({ value: count() })
      .from(diagnoses);
    const [medicationCount] = await database
      .select({ value: count() })
      .from(medications);
    const [testResultCount] = await database
      .select({ value: count() })
      .from(testResults);
    const [simulationStateCount] = await database
      .select({ value: count() })
      .from(simulationState);
    const [initializationEventCount] = await database
      .select({ value: count() })
      .from(simulationEvents);

    assert.equal(resourceCount?.value, 6);
    assert.equal(patientCount?.value, SEEDED_PATIENT_COUNT);
    assert.equal(stateCount?.value, 6);
    assert.equal(consultationCount?.value, SEEDED_PATIENT_COUNT);
    assert.ok((diagnosisCount?.value ?? 0) >= SEEDED_PATIENT_COUNT);
    assert.ok((medicationCount?.value ?? 0) >= SEEDED_PATIENT_COUNT);
    assert.ok((testResultCount?.value ?? 0) >= SEEDED_PATIENT_COUNT);
    assert.equal(simulationStateCount?.value, 1);
    assert.equal(initializationEventCount?.value, 1);
    await assert.rejects(
      client.execute({
        sql: "insert into resources (id, name, type, tag, service_duration_min) values (?, ?, ?, ?, ?)",
        args: ["invalid", "Invalid Resource", "invalid", "INVALID", 1],
      }),
      /CHECK constraint failed: resources_type_valid/,
    );
  } finally {
    client.close();
  }
});

test("a different explicit seed remains reproducible", () => {
  assert.deepEqual(
    buildSeedData(CANONICAL_SEED + 1),
    buildSeedData(CANONICAL_SEED + 1),
  );
  assert.notDeepEqual(buildSeedData(CANONICAL_SEED + 1), buildSeedData());
});
