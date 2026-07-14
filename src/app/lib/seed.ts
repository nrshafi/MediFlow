import type {
  Patient,
  PatientHistory,
  Resource,
  RequiredService,
  ServiceKind,
} from "./types";

// Deterministic PRNG (mulberry32) so the "simulation" is stable and reproducible.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DOCTORS = [
  { id: "dr-rahman", name: "Dr. Rahman", specialty: "General Medicine", tag: "DR-01" },
  { id: "dr-akter", name: "Dr. Akter", specialty: "Cardiology", tag: "DR-02" },
  { id: "dr-chowdhury", name: "Dr. Chowdhury", specialty: "Internal Medicine", tag: "DR-03" },
];

export function buildResources(): Resource[] {
  const base = {
    status: "available" as const,
    currentPatientId: null,
    queue: [] as string[],
    predictedWaitMin: 0,
    utilizationPct: 0,
    queueHistory: Array(30).fill(0) as number[],
    busyMinutes: 0,
  };
  return [
    ...DOCTORS.map((d) => ({
      id: d.id,
      name: d.name,
      type: "doctor" as const,
      specialty: d.specialty,
      tag: d.tag,
      ...base,
      queueHistory: Array(30).fill(0),
    })),
    { id: "lab", name: "Laboratory", type: "lab" as const, tag: "LAB", ...base, queueHistory: Array(30).fill(0) },
    { id: "xray", name: "X-Ray", type: "xray" as const, tag: "X-RAY", ...base, queueHistory: Array(30).fill(0) },
    { id: "ecg", name: "ECG", type: "ecg" as const, tag: "ECG", ...base, queueHistory: Array(30).fill(0) },
  ];
}

const NAMES: Array<[string, "male" | "female"]> = [
  ["Abdul Karim", "male"], ["Fatema Begum", "female"], ["Rahim Uddin", "male"],
  ["Nusrat Jahan", "female"], ["Kamal Hossain", "male"], ["Shirin Akhtar", "female"],
  ["Tanvir Ahmed", "male"], ["Salma Khatun", "female"], ["Jashim Uddin", "male"],
  ["Rokeya Sultana", "female"], ["Mizanur Rahman", "male"], ["Farhana Yasmin", "female"],
  ["Habibur Sheikh", "male"], ["Taslima Akter", "female"], ["Shafiqul Islam", "male"],
  ["Ayesha Siddika", "female"], ["Jahangir Alam", "male"], ["Morjina Khatun", "female"],
  ["Anwar Hossain", "male"], ["Rina Parvin", "female"], ["Belal Mia", "male"],
  ["Sabina Yasmin", "female"], ["Nazrul Islam", "male"], ["Hasina Akter", "female"],
  ["Sohel Rana", "male"], ["Momena Begum", "female"], ["Delwar Hossain", "male"],
  ["Ruma Akter", "female"], ["Faruk Ahmed", "male"], ["Jamila Khatun", "female"],
];

const CONDITIONS = [
  "Type 2 diabetes", "Hypertension", "Asthma", "Gastritis", "Anemia",
  "Chronic kidney disease", "Hyperthyroidism", "Osteoarthritis",
];
const MEDS: Array<[string, string, string]> = [
  ["Metformin", "500mg", "2×/day"],
  ["Amlodipine", "5mg", "1×/day"],
  ["Salbutamol", "100mcg", "as needed"],
  ["Omeprazole", "20mg", "1×/day"],
  ["Losartan", "50mg", "1×/day"],
  ["Atorvastatin", "10mg", "1×/day at night"],
];
const ALLERGIES: Array<{ substance: string; reaction: string; severity: "mild" | "moderate" | "severe" }> = [
  { substance: "Penicillin", reaction: "Skin rash", severity: "moderate" },
  { substance: "Sulfa drugs", reaction: "Anaphylaxis", severity: "severe" },
  { substance: "Aspirin", reaction: "Bronchospasm", severity: "moderate" },
  { substance: "Iodine contrast", reaction: "Hives", severity: "mild" },
];
const TESTS: Array<{ test: string; value: string; flag: "normal" | "abnormal" }> = [
  { test: "Fasting glucose", value: "7.8 mmol/L", flag: "abnormal" },
  { test: "CBC", value: "Within range", flag: "normal" },
  { test: "Serum creatinine", value: "1.9 mg/dL", flag: "abnormal" },
  { test: "Lipid profile", value: "LDL 165 mg/dL", flag: "abnormal" },
  { test: "TSH", value: "2.1 mIU/L", flag: "normal" },
  { test: "Hemoglobin", value: "10.2 g/dL", flag: "abnormal" },
];
const TREATMENTS: Array<{ procedure: string; note: string }> = [
  { procedure: "Nebulization", note: "Responded well, discharged same day" },
  { procedure: "IV fluids", note: "For dehydration during gastroenteritis" },
  { procedure: "ECG monitoring", note: "No acute changes noted" },
  { procedure: "Wound dressing", note: "Healing without infection" },
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function buildHistory(rng: () => number): PatientHistory {
  const nDiag = 1 + Math.floor(rng() * 3);
  const nMed = 1 + Math.floor(rng() * 3);
  const nTest = 1 + Math.floor(rng() * 3);
  const usedCond = new Set<string>();
  const diagnoses = Array.from({ length: nDiag }, () => {
    let c = pick(CONDITIONS, rng);
    while (usedCond.has(c)) c = pick(CONDITIONS, rng);
    usedCond.add(c);
    return { condition: c, year: 2016 + Math.floor(rng() * 9) };
  });
  const usedMed = new Set<string>();
  const medications = Array.from({ length: nMed }, () => {
    let m = pick(MEDS, rng);
    while (usedMed.has(m[0])) m = pick(MEDS, rng);
    usedMed.add(m[0]);
    return { name: m[0], dose: m[1], frequency: m[2] };
  });
  const hasAllergy = rng() > 0.45;
  const allergies = hasAllergy ? [pick(ALLERGIES, rng)] : [];
  const usedTest = new Set<string>();
  const recentTests = Array.from({ length: nTest }, () => {
    let t = pick(TESTS, rng);
    while (usedTest.has(t.test)) t = pick(TESTS, rng);
    usedTest.add(t.test);
    return { ...t, date: `${2024 + Math.floor(rng() * 2)}-0${1 + Math.floor(rng() * 8)}-1${Math.floor(rng() * 9)}` };
  });
  const treatments = rng() > 0.4 ? [{ ...pick(TREATMENTS, rng), date: `${2023 + Math.floor(rng() * 2)}-0${1 + Math.floor(rng() * 8)}-2${Math.floor(rng() * 8)}` }] : [];
  return { diagnoses, medications, allergies, recentTests, treatments };
}

export function buildPatients(): Patient[] {
  const rng = makeRng(20260714);
  const doctorIds = DOCTORS.map((d) => d.id);

  // Arrival minutes distributed 09:00–13:00 (0–240), peak 09:30–11:00 (30–120)
  const arrivals: number[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const peak = rng() < 0.6;
    const t = peak
      ? 30 + Math.floor(rng() * 90)
      : Math.floor(rng() * 240);
    arrivals.push(t);
  }
  arrivals.sort((a, b) => a - b);

  return NAMES.map(([name, gender], i) => {
    const priority = rng() < 0.15 ? "urgent" : "normal";
    // Required diagnostics: 0–2 tests + always a consultation
    const diagPool: ServiceKind[] = ["lab", "xray", "ecg"];
    const nDiag = Math.floor(rng() * 3); // 0,1,2
    const chosen = new Set<ServiceKind>();
    while (chosen.size < nDiag) chosen.add(pick(diagPool, rng));
    const doctorId = pick(doctorIds, rng);
    const requiredServices: RequiredService[] = [
      ...Array.from(chosen).map((k) => ({ kind: k, done: false })),
      { kind: "consultation" as ServiceKind, doctorId, done: false },
    ];
    const age = 8 + Math.floor(rng() * 68);
    return {
      id: `pat-${i + 1}`,
      token: `P-${String(i + 1).padStart(3, "0")}`,
      name,
      age,
      gender,
      arrivalTime: arrivals[i],
      priority,
      requiredServices,
      estimatedConsultationDuration: 8 + Math.floor(rng() * 13), // 8–20
      currentStage: "registration",
      queuePosition: 0,
      timeline: [{ stage: "registration", start: null, end: null }],
      history: buildHistory(rng),
      serviceEndsAt: null,
      currentResourceId: null,
      completedAt: null,
      waitedMin: 0,
      servedMin: 0,
      registered: false,
    };
  });
}

// Service duration ranges (min) — fixed midpoints keep display deterministic.
export const SERVICE_DURATION: Record<string, number> = {
  consultation: 0, // uses per-patient estimate
  lab: 8,
  xray: 9,
  ecg: 6,
  pharmacy: 4,
  billing: 3,
};
