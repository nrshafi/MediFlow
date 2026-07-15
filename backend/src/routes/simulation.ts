import type {
  ApiSuccess,
  SimulationStatus,
  SimulationTickResult,
} from "@mediflow/shared";
import type { Handler } from "hono";
import { createDatabase, type Database } from "../db/client";
import type { Bindings } from "../env";
import { advanceSimulation, getSimulationStatus } from "../simulation/clock";
import { getOperationsSnapshot } from "../services/operations";
import { explainRecommendation } from "../llm/service";

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
      const database = databaseFactory(context.env);
      const data = await advanceSimulation(database);
      const patientIds = [
        ...new Set(
          data.events
            .filter((event) => event.type === "recommendation_created")
            .flatMap((event) => (event.patientId ? [event.patientId] : [])),
        ),
      ];
      if (patientIds.length > 0 && context.env.GEMINI_API_KEY?.trim()) {
        const snapshot = await getOperationsSnapshot(database);
        const patientById = new Map(
          snapshot.patients.map((patient) => [patient.id, patient]),
        );
        await Promise.all(
          patientIds.map(async (patientId) => {
            const patient = patientById.get(patientId);
            const recommendation = snapshot.recommendations[patientId];
            if (!patient || !recommendation) return;
            await explainRecommendation({
              database,
              bindings: context.env,
              patient,
              recommendation,
            });
          }),
        );
      }
      const response: ApiSuccess<SimulationTickResult> = { data };
      return context.json(response);
    },
  };
}
