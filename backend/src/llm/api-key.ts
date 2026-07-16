import type { Bindings } from "../env";
import { MAX_GEMINI_API_KEY_LENGTH } from "@mediflow/shared";

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_VERIFICATION_TIMEOUT_MS = 5_000;

export class InvalidGeminiApiKeyError extends Error {
  constructor() {
    super("The provided Gemini API key is invalid");
    this.name = "InvalidGeminiApiKeyError";
  }
}

export class GeminiApiKeyVerificationUnavailableError extends Error {
  constructor() {
    super("Gemini could not verify this API key right now");
    this.name = "GeminiApiKeyVerificationUnavailableError";
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

export function resolveGeminiModel(bindings: Bindings): string {
  return bindings.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export async function verifyGeminiApiKey(
  apiKey: string,
  model: string,
  timeoutMs = GEMINI_VERIFICATION_TIMEOUT_MS,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}`,
      {
        headers: { "x-goog-api-key": apiKey },
        signal: controller.signal,
      },
    );
  } catch {
    throw new GeminiApiKeyVerificationUnavailableError();
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) return;
  if ([400, 401, 403].includes(response.status)) {
    throw new InvalidGeminiApiKeyError();
  }
  throw new GeminiApiKeyVerificationUnavailableError();
}
