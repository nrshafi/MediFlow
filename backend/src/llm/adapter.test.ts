import assert from "node:assert/strict";
import { test } from "node:test";
import { GeminiLanguageModel } from "./adapter";
import { stableSourceHash } from "./service";

test("Gemini adapter validates and returns generated text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "  Proceed to the lab.  " }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  try {
    const model = new GeminiLanguageModel("test-key", "test-model");
    assert.equal(
      await model.generate({ system: "Use supplied facts", prompt: "Lab next" }),
      "Proceed to the lab.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("source hashes are stable and change with their source", () => {
  assert.equal(stableSourceHash({ a: 1 }), stableSourceHash({ a: 1 }));
  assert.notEqual(stableSourceHash({ a: 1 }), stableSourceHash({ a: 2 }));
});
