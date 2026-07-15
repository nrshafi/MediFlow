import type {
  ApiError,
  ApiSuccess,
  DoctorBriefResult,
  Patient,
} from "@mediflow/shared";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
import type { Handler } from "hono";
import { createDatabase } from "../db/client";
import { generateDoctorBrief } from "../llm/service";
import { parseGeminiFallbackApiKey } from "../llm/api-key";
import { getOperationsSnapshot } from "../services/operations";
import type { AppEnvironment, DatabaseFactory } from "./simulation";

function fallbackBrief(patient: Patient): string {
  const abnormal = patient.history.recentTests.filter(
    (result) => result.flag === "abnormal",
  );
  const allergies = patient.history.allergies.length
    ? patient.history.allergies
        .map((allergy) => `${allergy.substance} (${allergy.reaction})`)
        .join(", ")
    : "none recorded";
  const diagnoses = patient.history.diagnoses.length
    ? patient.history.diagnoses
        .map((diagnosis) => `${diagnosis.condition} (${diagnosis.year})`)
        .join(", ")
    : "none recorded";
  const medications = patient.history.medications.length
    ? patient.history.medications
        .map(
          (medication) =>
            `${medication.name} ${medication.dose}, ${medication.frequency}`,
        )
        .join(", ")
    : "none recorded";
  const abnormalText = abnormal.length
    ? abnormal
        .map((result) => `${result.test}: ${result.value} (${result.date})`)
        .join(", ")
    : "none recorded";
  const recentTests = patient.history.recentTests.length
    ? patient.history.recentTests
        .map((result) => `${result.test}: ${result.value} (${result.date})`)
        .join(", ")
    : "none recorded";
  const treatments = patient.history.treatments.length
    ? patient.history.treatments
        .map(
          (treatment) =>
            `${treatment.procedure} (${treatment.date}): ${treatment.note}`,
        )
        .join(", ")
    : "none recorded";
  return [
    `Allergies: ${allergies}`,
    `Abnormal results: ${abnormalText}`,
    `Previous diagnoses: ${diagnoses}`,
    `Current medications: ${medications}`,
    `Recent tests: ${recentTests}`,
    `Treatments: ${treatments}`,
  ].join("\n");
}

export function createDoctorBriefHandler(
  databaseFactory: DatabaseFactory = createDatabase,
): Handler<AppEnvironment> {
  return async (context) => {
    const fallbackApiKey = parseGeminiFallbackApiKey(
      context.req.header(GEMINI_API_KEY_HEADER),
    );
    const patientId = (context.req.param("patientId") ?? "").trim();
    const database = databaseFactory(context.env);
    const snapshot = await getOperationsSnapshot(database);
    const patient = snapshot.patients.find((candidate) => candidate.id === patientId);
    if (!patient) {
      const response: ApiError = {
        error: { code: "PATIENT_NOT_FOUND", message: "Patient was not found" },
      };
      return context.json(response, 404);
    }
    const generated = await generateDoctorBrief({
      database,
      bindings: context.env,
      patient,
      fallbackApiKey,
    });
    const data: DoctorBriefResult = {
      patientId,
      content: generated ?? fallbackBrief(patient),
      generatedBy: generated ? "gemini" : "fallback",
    };
    const response: ApiSuccess<DoctorBriefResult> = { data };
    return context.json(response);
  };
}
