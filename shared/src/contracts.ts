import type {
  BottleneckAlert,
  Metrics,
  Patient,
  Recommendation,
  Resource,
  SimulationEventType,
} from "./domain";

export const GEMINI_API_KEY_HEADER = "X-Gemini-Api-Key";
export const MAX_GEMINI_API_KEY_LENGTH = 256;

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiError {
  error: ApiErrorDetail;
}

export interface HealthStatus {
  service: "mediflow-api";
  status: "ok";
}

export interface SimulationStatus {
  minute: number;
  playbackStatus: "paused" | "playing";
  speed: 1 | 4;
  seed: number;
  totalPatients: number;
  arrivedPatients: number;
  completedPatients: number;
}

export interface SimulationTickEvent {
  id: string;
  simulationMinute: number;
  orderInMinute: number;
  type: SimulationEventType;
  patientId: string | null;
  resourceId: string | null;
}

export interface SimulationTickResult {
  state: SimulationStatus;
  events: SimulationTickEvent[];
}

export interface SimulationResetResult {
  state: SimulationStatus;
}

export interface OperationsSnapshot {
  simulation: SimulationStatus;
  patients: Patient[];
  resources: Resource[];
  recommendations: Record<string, Recommendation>;
  alerts: BottleneckAlert[];
  metrics: Metrics;
}

export interface DoctorBriefResult {
  patientId: string;
  content: string;
  generatedBy: "gemini" | "fallback";
}

export interface GeminiApiKeyVerificationResult {
  verified: true;
}
