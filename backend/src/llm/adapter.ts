import type { Bindings } from "../env";
import { resolveGeminiApiKey } from "./api-key";

export interface LanguageModel {
  readonly provider: string;
  readonly model: string;
  generate(input: { system: string; prompt: string }): Promise<string>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export class GeminiLanguageModel implements LanguageModel {
  readonly provider = "google";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs = 8_000,
  ) {}

  async generate(input: { system: string; prompt: string }): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: input.system }] },
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 300,
            },
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Gemini returned status ${response.status}`);
      }
      const body = (await response.json()) as GeminiResponse;
      const text = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
      if (!text) throw new Error("Gemini returned no text");
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createLanguageModel(
  bindings: Bindings,
  fallbackApiKey?: string,
): LanguageModel | null {
  const apiKey = resolveGeminiApiKey(bindings, fallbackApiKey);
  if (!apiKey) return null;
  return new GeminiLanguageModel(
    apiKey,
    bindings.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
  );
}
