export type Priority = "normal" | "urgent";

export type ServiceKind = "consultation" | "lab" | "xray" | "ecg";

export type ResourceType = "doctor" | "lab" | "xray" | "ecg";

export type ResourceStatus = "available" | "busy" | "congested";

export type Stage =
  | "registration"
  | "lab"
  | "xray"
  | "ecg"
  | "consultation"
  | "pharmacy"
  | "billing"
  | "done";

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
  severity: "mild" | "moderate" | "severe";
}

export interface TestResult {
  test: string;
  value: string;
  date: string;
  flag: "normal" | "abnormal";
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
  gender: "male" | "female";
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
  speed: 1 | 4;
  patients: Patient[];
  resources: Resource[];
  recommendations: Record<string, Recommendation>;
  alerts: BottleneckAlert[];
  metrics: Metrics;
  loading: boolean;
}
