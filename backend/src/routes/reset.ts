import type {
  ApiError,
  ApiSuccess,
  SimulationResetResult,
} from "@mediflow/shared";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
import type { Handler } from "hono";
import { createDatabase } from "../db/client";
import { resetAndSeedDatabase } from "../db/seed";
import {
  parseGeminiFallbackApiKey,
  resolveGeminiModel,
  verifyGeminiApiKey,
} from "../llm/api-key";
import { getSimulationStatus } from "../simulation/clock";
import type { AppEnvironment, DatabaseFactory } from "./simulation";

const BEARER_PREFIX = "Bearer ";
const MAX_RESET_TOKEN_LENGTH = 256;
const textEncoder = new TextEncoder();

async function hashToken(token: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(token),
  );
  return new Uint8Array(digest);
}

async function tokensMatch(
  suppliedToken: string,
  expectedToken: string,
): Promise<boolean> {
  if (
    suppliedToken.length === 0 ||
    suppliedToken.length > MAX_RESET_TOKEN_LENGTH
  ) {
    return false;
  }

  const [suppliedHash, expectedHash] = await Promise.all([
    hashToken(suppliedToken),
    hashToken(expectedToken),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= suppliedHash[index]! ^ expectedHash[index]!;
  }
  return difference === 0;
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length).trim();
}

export function createResetHandler(
  databaseFactory: DatabaseFactory = createDatabase,
): Handler<AppEnvironment> {
  return async (context) => {
    const expectedToken = context.env.DEMO_RESET_TOKEN?.trim();
    const suppliedToken = bearerToken(context.req.header("Authorization"));
    const hasResetTokenAccess = Boolean(
      expectedToken &&
        suppliedToken &&
        (await tokensMatch(suppliedToken, expectedToken)),
    );
    const workerGeminiKeyConfigured = Boolean(
      context.env.GEMINI_API_KEY?.trim(),
    );
    const sessionGeminiKey = workerGeminiKeyConfigured || hasResetTokenAccess
      ? undefined
      : parseGeminiFallbackApiKey(
          context.req.header(GEMINI_API_KEY_HEADER),
        );
    if (sessionGeminiKey) {
      await verifyGeminiApiKey(
        sessionGeminiKey,
        resolveGeminiModel(context.env),
      );
    }
    const hasSessionGeminiAccess = Boolean(sessionGeminiKey);

    if (!expectedToken && !hasSessionGeminiAccess) {
      const response: ApiError = {
        error: {
          code: "DEMO_RESET_DISABLED",
          message: "Demo reset is not configured",
        },
      };
      return context.json(response, 503);
    }

    if (!hasSessionGeminiAccess && !hasResetTokenAccess) {
      const response: ApiError = {
        error: {
          code: "DEMO_RESET_UNAUTHORIZED",
          message: "The demo reset key is invalid",
        },
      };
      context.header("WWW-Authenticate", 'Bearer realm="mediflow-demo-reset"');
      return context.json(response, 401);
    }

    const database = databaseFactory(context.env);
    await resetAndSeedDatabase(database);
    const response: ApiSuccess<SimulationResetResult> = {
      data: { state: await getSimulationStatus(database) },
    };
    return context.json(response);
  };
}
