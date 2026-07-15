import type {
  AllergySeverity,
  Gender,
  PatientHistory,
  ServiceKind,
  TestResultFlag,
} from "@mediflow/shared";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "./client";
import { computeNaiveFifoBaseline } from "../engine/baseline";
import {
  allergies,
  diagnoses,
  llmOutputs,
  medications,
  metricSnapshots,
  patients,
  patientTimeline,
  requiredServices,
  resourceQueue,
  resources,
  resourceState,
  simulationEvents,
  simulationState,
  testResults,
  treatments,
} from "./schema";

export const CANONICAL_SEED = 20_260_714;
export const SEEDED_PATIENT_COUNT = 30;

type DiagnosticKind = Exclude<ServiceKind, "consultation">;
type NewAllergy = typeof allergies.$inferInsert;
type NewDiagnosis = typeof diagnoses.$inferInsert;
type NewMedication = typeof medications.$inferInsert;
type NewPatient = typeof patients.$inferInsert;
type NewRequiredService = typeof requiredServices.$inferInsert;
type NewResource = typeof resources.$inferInsert;
type NewResourceState = typeof resourceState.$inferInsert;
type NewTestResult = typeof testResults.$inferInsert;
type NewTimelineEntry = typeof patientTimeline.$inferInsert;
type NewTreatment = typeof treatments.$inferInsert;

const DOCTORS = [
  {
    id: "dr-rahman",
    name: "Dr. Rahman",
    specialty: "General Medicine",
    tag: "DR-01",
  },
  {
    id: "dr-akter",
    name: "Dr. Akter",
    specialty: "Cardiology",
    tag: "DR-02",
  },
  {
    id: "dr-chowdhury",
    name: "Dr. Chowdhury",
    specialty: "Internal Medicine",
    tag: "DR-03",
  },
] as const;

const PEOPLE = [
  ["Abdul Karim", "male"],
  ["Fatema Begum", "female"],
  ["Rahim Uddin", "male"],
  ["Nusrat Jahan", "female"],
  ["Kamal Hossain", "male"],
  ["Shirin Akhtar", "female"],
  ["Tanvir Ahmed", "male"],
  ["Salma Khatun", "female"],
  ["Jashim Uddin", "male"],
  ["Rokeya Sultana", "female"],
  ["Mizanur Rahman", "male"],
  ["Farhana Yasmin", "female"],
  ["Habibur Sheikh", "male"],
  ["Taslima Akter", "female"],
  ["Shafiqul Islam", "male"],
  ["Ayesha Siddika", "female"],
  ["Jahangir Alam", "male"],
  ["Morjina Khatun", "female"],
  ["Anwar Hossain", "male"],
  ["Rina Parvin", "female"],
  ["Belal Mia", "male"],
  ["Sabina Yasmin", "female"],
  ["Nazrul Islam", "male"],
  ["Hasina Akter", "female"],
  ["Sohel Rana", "male"],
  ["Momena Begum", "female"],
  ["Delwar Hossain", "male"],
  ["Ruma Akter", "female"],
  ["Faruk Ahmed", "male"],
  ["Jamila Khatun", "female"],
] as const satisfies ReadonlyArray<readonly [string, Gender]>;

const CONDITIONS = [
  "Type 2 diabetes",
  "Hypertension",
  "Asthma",
  "Gastritis",
  "Anemia",
  "Chronic kidney disease",
  "Hyperthyroidism",
  "Osteoarthritis",
] as const;

const MEDICATIONS = [
  ["Metformin", "500mg", "twice daily"],
  ["Amlodipine", "5mg", "once daily"],
  ["Salbutamol", "100mcg", "as needed"],
  ["Omeprazole", "20mg", "once daily"],
  ["Losartan", "50mg", "once daily"],
  ["Atorvastatin", "10mg", "once nightly"],
] as const;

const ALLERGY_OPTIONS = [
  { substance: "Penicillin", reaction: "Skin rash", severity: "moderate" },
  { substance: "Sulfa drugs", reaction: "Anaphylaxis", severity: "severe" },
  { substance: "Aspirin", reaction: "Bronchospasm", severity: "moderate" },
  { substance: "Iodine contrast", reaction: "Hives", severity: "mild" },
] as const satisfies ReadonlyArray<{
  substance: string;
  reaction: string;
  severity: AllergySeverity;
}>;

const TEST_OPTIONS = [
  { test: "Fasting glucose", value: "7.8 mmol/L", flag: "abnormal" },
  { test: "CBC", value: "Within range", flag: "normal" },
  { test: "Serum creatinine", value: "1.9 mg/dL", flag: "abnormal" },
  { test: "Lipid profile", value: "LDL 165 mg/dL", flag: "abnormal" },
  { test: "TSH", value: "2.1 mIU/L", flag: "normal" },
  { test: "Hemoglobin", value: "10.2 g/dL", flag: "abnormal" },
] as const satisfies ReadonlyArray<{
  test: string;
  value: string;
  flag: TestResultFlag;
}>;

const TREATMENT_OPTIONS = [
  {
    procedure: "Nebulization",
    note: "Responded well and was discharged the same day",
  },
  {
    procedure: "IV fluids",
    note: "Administered for dehydration during gastroenteritis",
  },
  { procedure: "ECG monitoring", note: "No acute changes noted" },
  { procedure: "Wound dressing", note: "Healing without infection" },
] as const;

export interface SeedData {
  resources: NewResource[];
  resourceState: NewResourceState[];
  patients: NewPatient[];
  requiredServices: NewRequiredService[];
  timeline: NewTimelineEntry[];
  diagnoses: NewDiagnosis[];
  medications: NewMedication[];
  allergies: NewAllergy[];
  testResults: NewTestResult[];
  treatments: NewTreatment[];
}

export function makeDeterministicRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: readonly T[], rng: () => number): T {
  const item = items[Math.floor(rng() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot pick from an empty seed collection");
  }

  return item;
}

function simulatedDate(year: number, rng: () => number): string {
  const month = 1 + Math.floor(rng() * 8);
  const day = 10 + Math.floor(rng() * 18);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildHistory(rng: () => number): PatientHistory {
  const diagnosisCount = 1 + Math.floor(rng() * 3);
  const medicationCount = 1 + Math.floor(rng() * 3);
  const testCount = 1 + Math.floor(rng() * 3);

  const usedConditions = new Set<string>();
  const historyDiagnoses = Array.from({ length: diagnosisCount }, () => {
    let condition = pick(CONDITIONS, rng);
    while (usedConditions.has(condition)) {
      condition = pick(CONDITIONS, rng);
    }
    usedConditions.add(condition);
    return { condition, year: 2016 + Math.floor(rng() * 9) };
  });

  const usedMedications = new Set<string>();
  const historyMedications = Array.from({ length: medicationCount }, () => {
    let medication = pick(MEDICATIONS, rng);
    while (usedMedications.has(medication[0])) {
      medication = pick(MEDICATIONS, rng);
    }
    usedMedications.add(medication[0]);
    return {
      name: medication[0],
      dose: medication[1],
      frequency: medication[2],
    };
  });

  const historyAllergies =
    rng() > 0.45 ? [{ ...pick(ALLERGY_OPTIONS, rng) }] : [];

  const usedTests = new Set<string>();
  const recentTests = Array.from({ length: testCount }, () => {
    let result = pick(TEST_OPTIONS, rng);
    while (usedTests.has(result.test)) {
      result = pick(TEST_OPTIONS, rng);
    }
    usedTests.add(result.test);
    return {
      ...result,
      date: simulatedDate(2024 + Math.floor(rng() * 2), rng),
    };
  });

  const historyTreatments =
    rng() > 0.4
      ? [
          {
            ...pick(TREATMENT_OPTIONS, rng),
            date: simulatedDate(2023 + Math.floor(rng() * 2), rng),
          },
        ]
      : [];

  return {
    diagnoses: historyDiagnoses,
    medications: historyMedications,
    allergies: historyAllergies,
    recentTests,
    treatments: historyTreatments,
  };
}

function buildResourceSeed(): NewResource[] {
  return [
    ...DOCTORS.map((doctor) => ({
      ...doctor,
      type: "doctor" as const,
      serviceDurationMin: null,
    })),
    {
      id: "lab",
      name: "Laboratory",
      type: "lab",
      tag: "LAB",
      serviceDurationMin: 8,
    },
    {
      id: "xray",
      name: "X-Ray",
      type: "xray",
      tag: "X-RAY",
      serviceDurationMin: 9,
    },
    {
      id: "ecg",
      name: "ECG",
      type: "ecg",
      tag: "ECG",
      serviceDurationMin: 6,
    },
  ];
}

export function buildSeedData(seed = CANONICAL_SEED): SeedData {
  const rng = makeDeterministicRng(seed);
  const seededResources = buildResourceSeed();
  const seededResourceState: NewResourceState[] = seededResources.map(
    (resource) => ({ resourceId: resource.id }),
  );
  const arrivals = PEOPLE.map(() => {
    const inMorningPeak = rng() < 0.6;
    return inMorningPeak
      ? 30 + Math.floor(rng() * 90)
      : Math.floor(rng() * 240);
  }).sort((left, right) => left - right);

  const seededPatients: NewPatient[] = [];
  const seededServices: NewRequiredService[] = [];
  const seededTimeline: NewTimelineEntry[] = [];
  const seededDiagnoses: NewDiagnosis[] = [];
  const seededMedications: NewMedication[] = [];
  const seededAllergies: NewAllergy[] = [];
  const seededTestResults: NewTestResult[] = [];
  const seededTreatments: NewTreatment[] = [];
  const doctorIds = DOCTORS.map((doctor) => doctor.id);
  const diagnosticKinds = ["lab", "xray", "ecg"] as const;

  PEOPLE.forEach(([name, gender], index) => {
    const patientNumber = index + 1;
    const patientId = `pat-${patientNumber}`;
    const priority = rng() < 0.15 ? "urgent" : "normal";
    const diagnosticCount = Math.floor(rng() * 3);
    const selectedDiagnostics = new Set<DiagnosticKind>();
    while (selectedDiagnostics.size < diagnosticCount) {
      selectedDiagnostics.add(pick(diagnosticKinds, rng));
    }
    const doctorId = pick(doctorIds, rng);

    seededPatients.push({
      id: patientId,
      token: `P-${String(patientNumber).padStart(3, "0")}`,
      name,
      age: 8 + Math.floor(rng() * 68),
      gender,
      arrivalMinute: arrivals[index] ?? 0,
      priority,
      estimatedConsultationDuration: 8 + Math.floor(rng() * 13),
    });

    const serviceKinds: ServiceKind[] = [
      ...selectedDiagnostics,
      "consultation",
    ];
    serviceKinds.forEach((kind, position) => {
      seededServices.push({
        patientId,
        position,
        kind,
        doctorId: kind === "consultation" ? doctorId : null,
      });
    });
    seededTimeline.push({
      patientId,
      position: 0,
      stage: "registration",
    });

    const history = buildHistory(rng);
    history.diagnoses.forEach((diagnosis, historyIndex) => {
      seededDiagnoses.push({
        id: `${patientId}-diagnosis-${historyIndex + 1}`,
        patientId,
        ...diagnosis,
      });
    });
    history.medications.forEach((medication, historyIndex) => {
      seededMedications.push({
        id: `${patientId}-medication-${historyIndex + 1}`,
        patientId,
        ...medication,
      });
    });
    history.allergies.forEach((allergy, historyIndex) => {
      seededAllergies.push({
        id: `${patientId}-allergy-${historyIndex + 1}`,
        patientId,
        ...allergy,
      });
    });
    history.recentTests.forEach((result, historyIndex) => {
      seededTestResults.push({
        id: `${patientId}-test-${historyIndex + 1}`,
        patientId,
        ...result,
      });
    });
    history.treatments.forEach((treatment, historyIndex) => {
      seededTreatments.push({
        id: `${patientId}-treatment-${historyIndex + 1}`,
        patientId,
        ...treatment,
      });
    });
  });

  return {
    resources: seededResources,
    resourceState: seededResourceState,
    patients: seededPatients,
    requiredServices: seededServices,
    timeline: seededTimeline,
    diagnoses: seededDiagnoses,
    medications: seededMedications,
    allergies: seededAllergies,
    testResults: seededTestResults,
    treatments: seededTreatments,
  };
}

export async function resetAndSeedDatabase(
  database: Database,
  seed = CANONICAL_SEED,
): Promise<SeedData> {
  const data = buildSeedData(seed);
  const baseline = computeNaiveFifoBaseline({
    patients: data.patients.map((patient) => ({
      id: patient.id,
      arrivalMinute: patient.arrivalMinute,
      estimatedConsultationDuration: patient.estimatedConsultationDuration,
    })),
    services: data.requiredServices.map((service) => ({
      patientId: service.patientId,
      position: service.position,
      kind: service.kind,
      doctorId: service.doctorId ?? null,
    })),
    resources: data.resources.map((resource) => ({
      id: resource.id,
      type: resource.type,
      serviceDurationMin: resource.serviceDurationMin ?? null,
    })),
  });
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    database.delete(llmOutputs),
    database.delete(metricSnapshots),
    database.delete(simulationEvents),
    database.delete(patientTimeline),
    database.delete(treatments),
    database.delete(testResults),
    database.delete(allergies),
    database.delete(medications),
    database.delete(diagnoses),
    database.delete(requiredServices),
    database.delete(resourceQueue),
    database.delete(resourceState),
    database.delete(patients),
    database.delete(resources),
    database.delete(simulationState),
    database.insert(resources).values(data.resources),
    database.insert(patients).values(data.patients),
    database.insert(resourceState).values(data.resourceState),
    database.insert(requiredServices).values(data.requiredServices),
    database.insert(patientTimeline).values(data.timeline),
    database.insert(diagnoses).values(data.diagnoses),
    database.insert(medications).values(data.medications),
  ];

  if (data.allergies.length > 0) {
    statements.push(database.insert(allergies).values(data.allergies));
  }
  statements.push(database.insert(testResults).values(data.testResults));
  if (data.treatments.length > 0) {
    statements.push(database.insert(treatments).values(data.treatments));
  }
  statements.push(
    database.insert(simulationState).values({ id: "current", seed }),
    database.insert(metricSnapshots).values({
      simulationMinute: 0,
      kind: "baseline",
      ...baseline,
    }),
    database.insert(simulationEvents).values({
      id: "event-0001",
      simulationMinute: 0,
      orderInMinute: 0,
      type: "simulation_initialized",
      payload: {
        patientCount: data.patients.length,
        resourceCount: data.resources.length,
        seed,
      },
    }),
  );

  await database.batch(statements);

  return data;
}
