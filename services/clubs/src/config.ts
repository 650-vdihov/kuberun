import dotenv from "dotenv";

dotenv.config();

function getEnvString(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== "") {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`${name} is not set`);
}

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}

function getEnvStringList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const config = {
  port: getEnvInt("PORT", 4003),
  grpcPort: getEnvInt("GRPC_PORT", 50003),
  databaseUrl: getEnvString("DATABASE_URL"),
  authServiceUrl: getEnvString("AUTH_SERVICE_URL", "http://localhost:4001"),
  trustedOrigins: getEnvStringList("TRUSTED_ORIGINS", ["http://localhost:4000"]),
  readinessTimeoutMs: getEnvInt("READINESS_TIMEOUT_MS", 3000),
} as const;
