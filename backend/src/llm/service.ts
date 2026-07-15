import type { Patient, Recommendation } from "@mediflow/shared";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { llmOutputs } from "../db/schema";
import type { Bindings } from "../env";
import { createLanguageModel } from "./adapter";
import { doctorBriefPrompt, recommendationPrompt } from "./prompts";

export function stableSourceHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function recommendationSourceHash(
  patient: Patient,
  recommendation: Recommendation,
): string {
  return stableSourceHash({
    patientId: patient.id,
    target: recommendation.nextResourceId,
    action: recommendation.actionText,
    reason: recommendation.reasonSummary,
    eta: recommendation.etaMin,
  });
}

export function doctorBriefSourceHash(patient: Patient): string {
  return stableSourceHash({ patientId: patient.id, history: patient.history });
}

async function cachedContent(
  database: Database,
  patientId: string,
  kind: "recommendation_explanation" | "doctor_brief",
  sourceHash: string,
): Promise<string | null> {
  const [cached] = await database
    .select({ content: llmOutputs.content })
    .from(llmOutputs)
    .where(
      and(
        eq(llmOutputs.patientId, patientId),
        eq(llmOutputs.kind, kind),
        eq(llmOutputs.sourceHash, sourceHash),
      ),
    )
    .orderBy(desc(llmOutputs.id))
    .limit(1);
  return cached?.content ?? null;
}

async function generateAndCache(input: {
  database: Database;
  bindings: Bindings;
  patientId: string;
  kind: "recommendation_explanation" | "doctor_brief";
  sourceHash: string;
  prompt: { system: string; prompt: string };
}): Promise<string | null> {
  const cached = await cachedContent(
    input.database,
    input.patientId,
    input.kind,
    input.sourceHash,
  );
  if (cached) return cached;
  const model = createLanguageModel(input.bindings);
  if (!model) return null;
  try {
    const content = await model.generate(input.prompt);
    await input.database
      .insert(llmOutputs)
      .values({
        cacheKey: `${input.kind}:${input.patientId}:${input.sourceHash}`,
        patientId: input.patientId,
        kind: input.kind,
        sourceHash: input.sourceHash,
        content,
        provider: model.provider,
        model: model.model,
      })
      .onConflictDoNothing({ target: llmOutputs.cacheKey });
    return content;
  } catch (error) {
    console.error(`LLM ${input.kind} generation failed`, error);
    return null;
  }
}

export async function explainRecommendation(input: {
  database: Database;
  bindings: Bindings;
  patient: Patient;
  recommendation: Recommendation;
}): Promise<string | null> {
  const sourceHash = recommendationSourceHash(
    input.patient,
    input.recommendation,
  );
  return generateAndCache({
    database: input.database,
    bindings: input.bindings,
    patientId: input.patient.id,
    kind: "recommendation_explanation",
    sourceHash,
    prompt: recommendationPrompt(input.patient, input.recommendation),
  });
}

export async function generateDoctorBrief(input: {
  database: Database;
  bindings: Bindings;
  patient: Patient;
}): Promise<string | null> {
  const sourceHash = doctorBriefSourceHash(input.patient);
  return generateAndCache({
    database: input.database,
    bindings: input.bindings,
    patientId: input.patient.id,
    kind: "doctor_brief",
    sourceHash,
    prompt: doctorBriefPrompt(input.patient),
  });
}
