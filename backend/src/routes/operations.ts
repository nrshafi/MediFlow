import type { ApiSuccess, OperationsSnapshot } from "@mediflow/shared";
import type { Handler } from "hono";
import { createDatabase } from "../db/client";
import { getOperationsSnapshot } from "../services/operations";
import type { AppEnvironment, DatabaseFactory } from "./simulation";

export function createOperationsHandler(
  databaseFactory: DatabaseFactory = createDatabase,
): Handler<AppEnvironment> {
  return async (context) => {
    const data = await getOperationsSnapshot(databaseFactory(context.env));
    const response: ApiSuccess<OperationsSnapshot> = { data };
    return context.json(response);
  };
}
