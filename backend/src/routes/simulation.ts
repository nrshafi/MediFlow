import type {
  ApiSuccess,
  SimulationStatus,
  SimulationTickResult,
} from "@mediflow/shared";
import type { Handler } from "hono";
import { createDatabase, type Database } from "../db/client";
import type { Bindings } from "../env";
import { advanceSimulation, getSimulationStatus } from "../simulation/clock";

export type AppEnvironment = {
  Bindings: Bindings;
};

export type DatabaseFactory = (bindings: Bindings) => Database;

export function createSimulationHandlers(
  databaseFactory: DatabaseFactory = createDatabase,
): {
  getState: Handler<AppEnvironment>;
  tick: Handler<AppEnvironment>;
} {
  return {
    getState: async (context) => {
      const data = await getSimulationStatus(databaseFactory(context.env));
      const response: ApiSuccess<SimulationStatus> = { data };
      return context.json(response);
    },
    tick: async (context) => {
      const data = await advanceSimulation(databaseFactory(context.env));
      const response: ApiSuccess<SimulationTickResult> = { data };
      return context.json(response);
    },
  };
}
