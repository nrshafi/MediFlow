import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../app";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
import type { Database } from "../db/client";
import { resetAndSeedDatabase } from "../db/seed";
import { patients } from "../db/schema";
import * as schema from "../db/schema";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

test("a user-provided Gemini key is verified against the configured model", async () => {
  const originalFetch = globalThis.fetch;
  let verificationCalls = 0;
  globalThis.fetch = async (input, init) => {
    verificationCalls += 1;
    assert.equal(
      String(input),
      "https://generativelanguage.googleapis.com/v1beta/models/test-model",
    );
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "valid-session-key",
    );
    return new Response(JSON.stringify({ name: "models/test-model" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const app = createApp();
    const response = await app.request(
      "/api/llm/verify-key",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "valid-session-key" },
      },
      { GEMINI_MODEL: "test-model" },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { verified: true } });
    assert.equal(verificationCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini rejects an incorrect user-provided key", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 400 });
  try {
    const app = createApp();
    const response = await app.request(
      "/api/llm/verify-key",
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("temporary Gemini verification failures do not accept a key", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 429 });
  try {
    const app = createApp();
    const response = await app.request(
      "/api/llm/verify-key",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "quota-limited-session-key" },
      },
      {},
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "GEMINI_API_KEY_VERIFICATION_UNAVAILABLE",
        message: "Gemini could not verify this API key right now",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tick generation uses and caches a request Gemini key when the Worker key is unavailable", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;
  globalThis.fetch = async () => {
    geminiCalls += 1;
    return new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "Please proceed to your next station." }] } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);
    await database
      .update(patients)
      .set({ arrivalMinute: 1 })
      .where(eq(patients.id, "pat-1"));
    const app = createApp(() => database);
    const tickResponse = await app.request(
      "/api/simulation/tick",
      {
        method: "POST",
        headers: { [GEMINI_API_KEY_HEADER]: "request-test-key" },
      },
      { GEMINI_MODEL: "test-model" },
    );
    assert.equal(tickResponse.status, 200);
    assert.equal(geminiCalls, 1);

    const operationsResponse = await app.request("/api/operations", undefined, {});
    const body = (await operationsResponse.json()) as {
      data: { recommendations: Record<string, { explanation: string }> };
    };
    assert.equal(
      body.data.recommendations["pat-1"]?.explanation,
      "Please proceed to your next station.",
    );
    assert.equal(geminiCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    client.close();
  }
});

test("invalid request Gemini keys are rejected before simulation work", async () => {
  const app = createApp(() => {
    throw new Error("Database access should not occur");
  });
  const response = await app.request(
    "/api/simulation/tick",
    {
      method: "POST",
      headers: { [GEMINI_API_KEY_HEADER]: "x".repeat(257) },
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
});
