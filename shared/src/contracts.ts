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
