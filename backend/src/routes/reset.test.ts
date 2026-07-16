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

test("a session Gemini key can reset when no Worker Gemini key is configured", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });
  const originalFetch = globalThis.fetch;
  let verificationCalls = 0;
  globalThis.fetch = async (_input, init) => {
    verificationCalls += 1;
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "session-gemini-key",
    );
    return new Response(JSON.stringify({ name: "models/test-model" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await advanceSimulation(database);
    const app = createApp(() => database);

    const response = await app.request(
      "/api/simulation/reset",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "session-gemini-key" },
      },
      { GEMINI_MODEL: "test-model" },
    );

    assert.equal(response.status, 200);
    assert.equal(verificationCalls, 1);
    assert.equal((await getSimulationStatus(database)).minute, 0);
  } finally {
    globalThis.fetch = originalFetch;
    client.close();
  }
});

test("an incorrect session Gemini key cannot authorize demo reset", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await advanceSimulation(database);
    const app = createApp(() => database);

    const response = await app.request(
      "/api/simulation/reset",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "incorrect-session-key" },
      },
      {},
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: "INVALID_GEMINI_API_KEY",
        message: "The provided Gemini API key is invalid",
      },
    });
    assert.equal((await getSimulationStatus(database)).minute, 1);
  } finally {
    globalThis.fetch = originalFetch;
    client.close();
  }
});

test("a session Gemini key cannot bypass reset protection when the Worker Gemini key is configured", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });

  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await advanceSimulation(database);
    const app = createApp(() => database);

    const response = await app.request(
      "/api/simulation/reset",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "session-gemini-key" },
      },
      {
        DEMO_RESET_TOKEN: resetToken,
        GEMINI_API_KEY: "worker-gemini-key",
      },
    );

    assert.equal(response.status, 401);
    assert.equal((await getSimulationStatus(database)).minute, 1);
  } finally {
    client.close();
  }
});
