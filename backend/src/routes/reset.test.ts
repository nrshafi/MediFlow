import { createClient } from "@libsql/client";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../app";
import type { Database } from "../db/client";
import { resetAndSeedDatabase, SEEDED_PATIENT_COUNT } from "../db/seed";
import { patients, simulationEvents } from "../db/schema";
import * as schema from "../db/schema";
import { advanceSimulation, getSimulationStatus } from "../simulation/clock";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);
const resetToken = "test-only-demo-reset-token";

test("demo reset rejects disabled and invalid credentials", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await advanceSimulation(database);
    const app = createApp(() => database);

    const disabledResponse = await app.request(
      "/api/simulation/reset",
      { method: "POST" },
      {},
    );
    assert.equal(disabledResponse.status, 503);
    assert.deepEqual(await disabledResponse.json(), {
      error: {
        code: "DEMO_RESET_DISABLED",
        message: "Demo reset is not configured",
      },
    });

    const unauthorizedResponse = await app.request(
      "/api/simulation/reset",
      {
        method: "POST",
        headers: { Authorization: "Bearer incorrect-token" },
      },
      { DEMO_RESET_TOKEN: resetToken },
    );
    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(
      unauthorizedResponse.headers.get("WWW-Authenticate"),
      'Bearer realm="mediflow-demo-reset"',
    );
    assert.equal((await getSimulationStatus(database)).minute, 1);
  } finally {
    client.close();
  }
});

test("authorized demo reset restores the canonical minute-zero fixture", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await advanceSimulation(database);
    await advanceSimulation(database);
    const app = createApp(() => database);

    const response = await app.request(
      "/api/simulation/reset",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${resetToken}` },
      },
      { DEMO_RESET_TOKEN: resetToken },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        state: {
          minute: 0,
          playbackStatus: "paused",
          speed: 1,
          seed: 20_260_714,
          totalPatients: SEEDED_PATIENT_COUNT,
          arrivedPatients: 0,
          completedPatients: 0,
        },
      },
    });

    const [patientCount] = await database
      .select({ value: count() })
      .from(patients);
    const [eventCount] = await database
      .select({ value: count() })
      .from(simulationEvents);
    assert.equal(patientCount?.value, SEEDED_PATIENT_COUNT);
    assert.equal(eventCount?.value, 1);

    const preflightResponse = await app.request(
      "/api/simulation/reset",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://mediflow.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": `Authorization, ${GEMINI_API_KEY_HEADER}`,
        },
      },
      { DEMO_RESET_TOKEN: resetToken },
    );
    assert.equal(preflightResponse.status, 204);
    assert.match(
      preflightResponse.headers.get("Access-Control-Allow-Headers") ?? "",
      /Authorization/i,
    );
    assert.match(
      preflightResponse.headers.get("Access-Control-Allow-Headers") ?? "",
      new RegExp(GEMINI_API_KEY_HEADER, "i"),
    );
  } finally {
    client.close();
  }
});
