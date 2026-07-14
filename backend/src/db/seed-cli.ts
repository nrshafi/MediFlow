import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { fileURLToPath } from "node:url";
import { parseTursoConfig } from "../env";
import type { Database } from "./client";
import { CANONICAL_SEED, resetAndSeedDatabase } from "./seed";
import * as schema from "./schema";

const config = parseTursoConfig({
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
});
const client = createClient(config);
const database: Database = drizzle(client, { schema });
const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

try {
  await migrate(database, { migrationsFolder });
  const data = await resetAndSeedDatabase(database, CANONICAL_SEED);
  console.log(
    `Seeded ${data.resources.length} resources and ${data.patients.length} simulated patients with seed ${CANONICAL_SEED}.`,
  );
} finally {
  client.close();
}
