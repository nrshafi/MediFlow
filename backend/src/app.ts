import type {
  ApiError,
  ApiSuccess,
  HealthStatus,
} from "@mediflow/shared";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createOperationsHandler } from "./routes/operations";
import { createDoctorBriefHandler } from "./routes/llm";
import { createGeminiApiKeyVerificationHandler } from "./routes/gemini-key";
import { createResetHandler } from "./routes/reset";
import {
  createSimulationHandlers,
  type AppEnvironment,
  type DatabaseFactory,
} from "./routes/simulation";
import {
  SimulationConflictError,
  SimulationInvariantError,
  SimulationNotInitializedError,
} from "./simulation/clock";
import {
  GeminiApiKeyVerificationUnavailableError,
  InvalidGeminiApiKeyError,
} from "./llm/api-key";

export function createApp(databaseFactory?: DatabaseFactory) {
  const app = new Hono<AppEnvironment>();
  const simulation = createSimulationHandlers(databaseFactory);
  const operations = createOperationsHandler(databaseFactory);
  const doctorBrief = createDoctorBriefHandler(databaseFactory);
  const verifyGeminiApiKey = createGeminiApiKeyVerificationHandler();
  const reset = createResetHandler(databaseFactory);

  app.use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", GEMINI_API_KEY_HEADER],
    }),
  );

  app.get("/api/health", (context) => {
    const response: ApiSuccess<HealthStatus> = {
      data: { service: "mediflow-api", status: "ok" },
    };
    return context.json(response);
  });

  app.get("/api/simulation", simulation.getState);
  app.post("/api/simulation/tick", simulation.tick);
  app.post("/api/simulation/reset", reset);
  app.get("/api/operations", operations);
  app.post("/api/llm/verify-key", verifyGeminiApiKey);
  app.get("/api/patients/:patientId/brief", doctorBrief);

  app.notFound((context) => {
    const response: ApiError = {
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exist",
      },
    };
    return context.json(response, 404);
  });

  app.onError((error, context) => {
    if (error instanceof SimulationNotInitializedError) {
      const response: ApiError = {
        error: {
          code: "SIMULATION_NOT_INITIALIZED",
          message: error.message,
        },
      };
      return context.json(response, 503);
    }
    if (error instanceof SimulationConflictError) {
      const response: ApiError = {
        error: { code: "SIMULATION_CONFLICT", message: error.message },
      };
      return context.json(response, 409);
    }
    if (error instanceof InvalidGeminiApiKeyError) {
      const response: ApiError = {
        error: { code: "INVALID_GEMINI_API_KEY", message: error.message },
      };
      return context.json(response, 400);
    }
    if (error instanceof GeminiApiKeyVerificationUnavailableError) {
      const response: ApiError = {
        error: {
          code: "GEMINI_API_KEY_VERIFICATION_UNAVAILABLE",
          message: error.message,
        },
      };
      return context.json(response, 503);
    }

    if (error instanceof SimulationInvariantError) {
      console.error("Simulation invariant violation", error);
    } else {
      console.error("Unhandled API error", error);
    }
    const response: ApiError = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    };
    return context.json(response, 500);
  });

  return app;
}
