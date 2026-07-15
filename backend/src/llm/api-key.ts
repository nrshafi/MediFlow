import type { Bindings } from "../env";
import { MAX_GEMINI_API_KEY_LENGTH } from "@mediflow/shared";

export class InvalidGeminiApiKeyError extends Error {
  constructor() {
    super("The provided Gemini API key is invalid");
    this.name = "InvalidGeminiApiKeyError";
  }
}

export function parseGeminiFallbackApiKey(
  headerValue: string | undefined,
): string | undefined {
  if (headerValue === undefined) return undefined;
  const apiKey = headerValue.trim();
  if (!apiKey || apiKey.length > MAX_GEMINI_API_KEY_LENGTH) {
    throw new InvalidGeminiApiKeyError();
  }
  return apiKey;
}

export function resolveGeminiApiKey(
  bindings: Bindings,
  fallbackApiKey?: string,
): string | undefined {
  return bindings.GEMINI_API_KEY?.trim() || fallbackApiKey;
}
