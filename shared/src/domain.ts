export const PRIORITIES = ["normal", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SERVICE_KINDS = ["consultation", "lab", "xray", "ecg"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const RESOURCE_TYPES = ["doctor", "lab", "xray", "ecg"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_STATUSES = ["available", "busy", "congested"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const STAGES = [
  "registration",
  "lab",
  "xray",
  "ecg",
  "consultation",
  "pharmacy",
  "billing",
  "done",
] as const;
export type Stage = (typeof STAGES)[number];

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const ALLERGY_SEVERITIES = ["mild", "moderate", "severe"] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export const TEST_RESULT_FLAGS = ["normal", "abnormal"] as const;
export type TestResultFlag = (typeof TEST_RESULT_FLAGS)[number];

export const SIMULATION_EVENT_TYPES = [
  "simulation_initialized",
  "clock_advanced",
  "patient_arrived",
  "patient_queued",
  "service_started",
  "service_completed",
  "recommendation_created",
] as const;
export type SimulationEventType = (typeof SIMULATION_EVENT_TYPES)[number];

export interface Diagnosis {
  condition: string;
  year: number;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
}

export interface Allergy {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
}

export interface TestResult {
  test: string;
  value: string;
  date: string;
  flag: TestResultFlag;
}

export interface Treatment {
  procedure: string;
  date: string;
  note: string;
}

export interface PatientHistory {
  diagnoses: Diagnosis[];
  medications: Medication[];
  allergies: Allergy[];
  recentTests: TestResult[];
  treatments: Treatment[];
}

export interface TimelineEvent {
  stage: Stage;
  start: number | null; // sim minute
  end: number | null;
}

export interface RequiredService {
  kind: ServiceKind;
  doctorId?: string; // for consultation
  done: boolean;
}

export interface Patient {
  id: string;
  token: string;
  name: string;
  age: number;
  gender: Gender;
  arrivalTime: number; // sim minute from 09:00
  priority: Priority;
  requiredServices: RequiredService[];
  estimatedConsultationDuration: number;
  currentStage: Stage;
  queuePosition: number;
  timeline: TimelineEvent[];
  history: PatientHistory;
  // internal sim bookkeeping
  serviceEndsAt: number | null; // sim minute the current service finishes
  currentResourceId: string | null;
  completedAt: number | null;
  // runtime accumulators (derived, kept in state for consistent metrics)
  waitedMin: number; // minutes spent queued/waiting
  servedMin: number; // minutes spent in active service
  registered: boolean;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  specialty?: string;
  tag: string; // mono tag e.g. DR-01, LAB
  status: ResourceStatus;
  currentPatientId: string | null;
  queue: string[];
  predictedWaitMin: number;
  utilizationPct: number;
  queueHistory: number[]; // last N ticks
  busyMinutes: number; // for utilization calc
}

export interface Recommendation {
  patientId: string;
  nextResourceId: string | null;
  actionText: string;
  reasonSummary: string;
  etaMin: number;
  minutesSaved: number;
  explanation: string;
}

export interface BottleneckAlert {
  id: string;
  resourceId: string;
  severity: "warning" | "critical";
  headline: string;
  suggestedAction: string;
  detectedAt: number;
}

export interface MetricsBlock {
  avgWaitMin: number;
  avgVisitMin: number;
  utilizationPct: number;
  avgQueueDepth: number;
  peakQueueDepth: number;
  patientsInHouse: number;
  completed: number;
}

export interface Metrics {
  live: MetricsBlock;
  baseline: MetricsBlock;
}

export interface SimState {
  minute: number; // minutes since 09:00
  playing: boolean;
  speed: 1 | 4 | 10;
  patients: Patient[];
  resources: Resource[];
  recommendations: Record<string, Recommendation>;
  alerts: BottleneckAlert[];
  metrics: Metrics;
  loading: boolean;
}
