import type { Patient, Recommendation } from "@mediflow/shared";

const LANGUAGE_ONLY_GUARDRAIL = `You are MediFlow's language layer. You never make scheduling, triage, diagnosis, treatment, or clinical decisions. Use only the supplied facts. Do not add medical advice, urgency, diagnoses, or operational instructions that are absent from the input.`;

export function recommendationPrompt(
  patient: Patient,
  recommendation: Recommendation,
): { system: string; prompt: string } {
  return {
    system: `${LANGUAGE_ONLY_GUARDRAIL} Rewrite an already-made deterministic scheduling recommendation for a patient in calm, plain language. Use at most two short sentences.`,
    prompt: JSON.stringify({
      patientToken: patient.token,
      action: recommendation.actionText,
      reason: recommendation.reasonSummary,
      estimatedWaitMinutes: recommendation.etaMin,
    }),
  };
}

export function doctorBriefPrompt(patient: Patient): {
  system: string;
  prompt: string;
} {
  return {
    system: `${LANGUAGE_ONLY_GUARDRAIL} Produce a concise pre-consultation record summary for a doctor. Highlight recorded allergies and abnormal results first. Do not infer diagnoses or recommend treatment. Return plain text only with no Markdown, bullets, or heading. Use exactly one line per category in this order: Allergies, Abnormal results, Previous diagnoses, Current medications, Recent tests, Treatments. Format every line as "Category: details" and clearly say "none recorded" when a category has no records.`,
    prompt: JSON.stringify({
      patient: {
        token: patient.token,
        age: patient.age,
        gender: patient.gender,
        priority: patient.priority,
      },
      history: patient.history,
    }),
  };
}
