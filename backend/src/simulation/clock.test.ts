import { createClient } from "@libsql/client";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../app";
import type { Database } from "../db/client";
import { resetAndSeedDatabase } from "../db/seed";
import {
  patients,
  patientTimeline,
  requiredServices,
  resourceState,
  simulationEvents,
} from "../db/schema";
import * as schema from "../db/schema";
import {
  advanceSimulation,
  getSimulationStatus,
  planSimulationTick,
} from "./clock";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

test("tick planning is deterministic and orders completions before arrivals", () => {
  const patientRows = [
    {
      id: "pat-2",
      arrivalMinute: 1,
      registered: false,
      currentStage: "registration" as const,
      currentResourceId: null,
      serviceEndsAtMinute: null,
    },
    {
      id: "pat-1",
      arrivalMinute: 0,
      registered: true,
      currentStage: "lab" as const,
      currentResourceId: "lab",
      serviceEndsAtMinute: 1,
    },
  ];
  const resources = [{ id: "lab", type: "lab" as const }];

  const first = planSimulationTick(0, patientRows, resources);
  const second = planSimulationTick(0, patientRows, resources);

  assert.deepEqual(first, second);
  assert.equal(first.nextMinute, 1);
  assert.deepEqual(
    first.events.map((event) => event.type),
    ["clock_advanced", "service_completed", "patient_arrived"],
  );
  assert.deepEqual(
    first.events.map((event) => event.orderInMinute),
    [0, 1, 2],
  );
});

test("one tick persists clock, completion, arrival, and API state", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);

    const [labService] = await database
      .select({ patientId: requiredServices.patientId })
      .from(requiredServices)
      .where(eq(requiredServices.kind, "lab"))
      .limit(1);
    assert.ok(labService);
    const [arrivalPatient] = await database
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.registered, false)))
      .limit(2);
    assert.ok(arrivalPatient);
    const arrivalPatientId =
      arrivalPatient.id === labService.patientId
        ? (
            await database
              .select({ id: patients.id })
              .from(patients)
              .where(eq(patients.registered, false))
              .limit(2)
          )[1]?.id
        : arrivalPatient.id;
    assert.ok(arrivalPatientId);

    await database.batch([
      database
        .update(patients)
        .set({
          registered: true,
          currentStage: "lab",
          currentResourceId: "lab",
          serviceEndsAtMinute: 1,
        })
        .where(eq(patients.id, labService.patientId)),
      database
        .update(resourceState)
        .set({
          status: "busy",
          currentPatientId: labService.patientId,
        })
        .where(eq(resourceState.resourceId, "lab")),
      database.insert(patientTimeline).values({
        patientId: labService.patientId,
        position: 1,
        stage: "lab",
        startedAtMinute: 0,
      }),
      database
        .update(patients)
        .set({ arrivalMinute: 1, registered: false })
        .where(eq(patients.id, arrivalPatientId)),
    ]);

    const result = await advanceSimulation(database);
    const [completedPatient] = await database
      .select()
      .from(patients)
      .where(eq(patients.id, labService.patientId));
    const [arrivedPatient] = await database
      .select()
      .from(patients)
      .where(eq(patients.id, arrivalPatientId));
    const [labState] = await database
      .select()
      .from(resourceState)
      .where(eq(resourceState.resourceId, "lab"));
    const [completedService] = await database
      .select()
      .from(requiredServices)
      .where(
        and(
          eq(requiredServices.patientId, labService.patientId),
          eq(requiredServices.kind, "lab"),
        ),
      );
    const [completedTimeline] = await database
      .select()
      .from(patientTimeline)
      .where(
        and(
          eq(patientTimeline.patientId, labService.patientId),
          eq(patientTimeline.stage, "lab"),
        ),
      );
    const [arrivalTimeline] = await database
      .select()
      .from(patientTimeline)
      .where(
        and(
          eq(patientTimeline.patientId, arrivalPatientId),
          eq(patientTimeline.stage, "registration"),
        ),
      );

    assert.equal(result.state.minute, 1);
    assert.equal(result.events[0]?.type, "clock_advanced");
    assert.ok(
      result.events.some(
        (event) =>
          event.type === "service_completed" &&
          event.patientId === labService.patientId,
      ),
    );
    assert.ok(
      result.events.some(
        (event) =>
          event.type === "patient_arrived" &&
          event.patientId === arrivalPatientId,
      ),
    );
    assert.equal(completedPatient?.currentResourceId, null);
    assert.equal(completedPatient?.serviceEndsAtMinute, null);
    assert.equal(arrivedPatient?.registered, true);
    assert.equal(labState?.status, "available");
    assert.equal(labState?.currentPatientId, null);
    assert.equal(completedService?.completed, true);
    assert.equal(completedTimeline?.endedAtMinute, 1);
    assert.equal(arrivalTimeline?.startedAtMinute, 1);
    assert.equal(arrivalTimeline?.endedAtMinute, 1);

    const [eventCount] = await database
      .select({ value: count() })
      .from(simulationEvents);
    assert.equal(eventCount?.value, result.events.length + 1);

    const app = createApp(() => database);
    const stateResponse = await app.request("/api/simulation", undefined, {});
    assert.equal(stateResponse.status, 200);
    const stateBody = (await stateResponse.json()) as {
      data: { minute: number };
    };
    assert.equal(stateBody.data.minute, 1);
    const tickResponse = await app.request(
      "/api/simulation/tick",
      { method: "POST" },
      {},
    );
    assert.equal(tickResponse.status, 200);
    const tickBody = (await tickResponse.json()) as {
      data: { state: { minute: number } };
    };
    assert.equal(tickBody.data.state.minute, 2);
    assert.equal((await getSimulationStatus(database)).minute, 2);
  } finally {
    client.close();
  }
});

test("simulation API reports an uninitialized database consistently", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    const response = await createApp(() => database).request(
      "/api/simulation",
      undefined,
      {},
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "SIMULATION_NOT_INITIALIZED",
        message: "Simulation data has not been initialized",
      },
    });
  } finally {
    client.close();
  }
});
