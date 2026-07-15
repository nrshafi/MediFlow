import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../app";
import type { Database } from "../db/client";
import { resetAndSeedDatabase } from "../db/seed";
import { patients } from "../db/schema";
import * as schema from "../db/schema";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

test("tick generation caches Gemini recommendation text for polling reads", async () => {
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
      { method: "POST" },
      { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" },
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
