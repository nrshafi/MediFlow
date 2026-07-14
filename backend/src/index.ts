import type {
  ApiError,
  ApiSuccess,
  HealthStatus,
} from "@mediflow/shared";
import { Hono } from "hono";
import type { Bindings } from "./env";

type WorkerEnvironment = {
  Bindings: Bindings;
};

const app = new Hono<WorkerEnvironment>();

app.get("/api/health", (context) => {
  const response: ApiSuccess<HealthStatus> = {
    data: {
      service: "mediflow-api",
      status: "ok",
    },
  };

  return context.json(response);
});

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
  console.error("Unhandled API error", error);

  const response: ApiError = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  };

  return context.json(response, 500);
});

export default app;
