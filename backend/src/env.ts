export interface Bindings {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TURSO_AUTH_TOKEN?: string;
  TURSO_DATABASE_URL?: string;
}

export interface TursoConfig {
  authToken: string;
  url: string;
}

export function parseTursoConfig(bindings: Bindings): TursoConfig {
  const url = bindings.TURSO_DATABASE_URL?.trim();
  const authToken = bindings.TURSO_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    throw new Error("Turso database bindings are not configured");
  }

  if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
    throw new Error("TURSO_DATABASE_URL must use libsql:// or https://");
  }

  return { authToken, url };
}
