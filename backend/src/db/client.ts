import { createClient } from "@libsql/client/web";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { Bindings } from "../env";
import { parseTursoConfig } from "../env";
import * as schema from "./schema";

export function createDatabase(bindings: Bindings) {
  const config = parseTursoConfig(bindings);
  const client = createClient(config);

  return drizzle(client, { schema });
}

export type Database = LibSQLDatabase<typeof schema>;
