import type { SimulationEventType } from "./domain";

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
