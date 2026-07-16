import type {
  ApiSuccess,
  GeminiApiKeyVerificationResult,
} from "@mediflow/shared";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
import type { Handler } from "hono";
import {
  InvalidGeminiApiKeyError,
  parseGeminiFallbackApiKey,
  resolveGeminiModel,
  verifyGeminiApiKey,
} from "../llm/api-key";
import type { AppEnvironment } from "./simulation";

export function createGeminiApiKeyVerificationHandler(): Handler<AppEnvironment> {
  return async (context) => {
    const apiKey = parseGeminiFallbackApiKey(
      context.req.header(GEMINI_API_KEY_HEADER),
    );
    if (!apiKey) throw new InvalidGeminiApiKeyError();

    await verifyGeminiApiKey(apiKey, resolveGeminiModel(context.env));

    const response: ApiSuccess<GeminiApiKeyVerificationResult> = {
      data: { verified: true },
    };
    return context.json(response);
  };
}
