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
  port: getEnvInt("PORT", 4004),
  databaseUrl: getEnvString(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5438/leaderboards_db"
  ),
  activityGrpcUrl: getEnvString("ACTIVITY_GRPC_URL", "localhost:50002"),
  clubsGrpcUrl: getEnvString("CLUBS_GRPC_URL", "localhost:50003"),
  authServiceUrl: getEnvString("AUTH_SERVICE_URL", "http://localhost:4001"),
  trustedOrigins: getEnvStringList("TRUSTED_ORIGINS", ["http://localhost:4000"]),
  readinessTimeoutMs: getEnvInt("READINESS_TIMEOUT_MS", 3000),
  rabbitmqUrl: getEnvString("RABBITMQ_URL"),
  rabbitmqRunCompletedQueue: getEnvString(
    "RABBITMQ_RUN_COMPLETED_QUEUE",
    "run.completed"
  ),
  rabbitmqReconnectIntervalMs: getEnvInt("RABBITMQ_RECONNECT_INTERVAL_MS", 10000),
  rabbitmqConnectionTimeoutMs: getEnvInt("RABBITMQ_CONNECTION_TIMEOUT_MS", 5000),
  rabbitmqHeartbeatSeconds: getEnvInt("RABBITMQ_HEARTBEAT_SECONDS", 30),
} as const;
