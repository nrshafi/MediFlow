import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import type { Bindings } from "../env";
import { parseTursoConfig } from "../env";

export function createDatabase(bindings: Bindings) {
  const config = parseTursoConfig(bindings);
  const client = createClient(config);

  return drizzle(client);
}

export type Database = ReturnType<typeof createDatabase>;
