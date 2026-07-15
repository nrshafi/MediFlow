import { createClient } from "@libsql/client";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Database } from "../db/client";
import { resetAndSeedDatabase, SEEDED_PATIENT_COUNT } from "../db/seed";
import { requiredServices } from "../db/schema";
import * as schema from "../db/schema";
import { getOperationsSnapshot } from "../services/operations";
import { advanceSimulation } from "./clock";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

test("a complete simulated day routes and completes every patient", async () => {
  const client = createClient({ url: "file::memory:" });
  const database: Database = drizzle(client, { schema });
  try {
    await migrate(database, { migrationsFolder });
    await resetAndSeedDatabase(database);

    let snapshot = await getOperationsSnapshot(database);
    while (
      snapshot.simulation.completedPatients < SEEDED_PATIENT_COUNT &&
      snapshot.simulation.minute < 1_000
    ) {
      await advanceSimulation(database);
      snapshot = await getOperationsSnapshot(database);
    }

    const [unfinishedServices] = await database
      .select({ value: count() })
      .from(requiredServices)
      .where(eq(requiredServices.completed, false));
    assert.equal(snapshot.simulation.completedPatients, SEEDED_PATIENT_COUNT);
    assert.equal(snapshot.metrics.live.completed, SEEDED_PATIENT_COUNT);
    assert.equal(snapshot.metrics.live.patientsInHouse, 0);
    assert.equal(unfinishedServices?.value, 0);
    assert.ok(snapshot.simulation.minute < 1_000);
    assert.ok(snapshot.metrics.live.avgWaitMin < snapshot.metrics.baseline.avgWaitMin);
    assert.ok(
      snapshot.metrics.live.avgVisitMin < snapshot.metrics.baseline.avgVisitMin,
      JSON.stringify(snapshot.metrics),
    );
    assert.ok(
      snapshot.metrics.live.utilizationPct >
        snapshot.metrics.baseline.utilizationPct,
      JSON.stringify(snapshot.metrics),
    );
    assert.ok(
      snapshot.metrics.live.avgQueueDepth <
        snapshot.metrics.baseline.avgQueueDepth,
      JSON.stringify(snapshot.metrics),
    );
    assert.ok(
      snapshot.metrics.live.peakQueueDepth <
        snapshot.metrics.baseline.peakQueueDepth,
      JSON.stringify(snapshot.metrics),
    );

    const [completedConsultations] = await database
      .select({ value: count() })
      .from(requiredServices)
      .where(
        and(
          eq(requiredServices.kind, "consultation"),
          eq(requiredServices.completed, true),
        ),
      );
    assert.equal(completedConsultations?.value, SEEDED_PATIENT_COUNT);
  } finally {
    client.close();
  }
});
