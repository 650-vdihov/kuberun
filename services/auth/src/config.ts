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

const port = getEnvInt("PORT", 4001);

export const config = {
  port,
  databaseUrl: getEnvString("DATABASE_URL"),
  trustedOrigins: getEnvStringList("TRUSTED_ORIGINS", ["http://localhost:4000"]),
  readinessTimeoutMs: getEnvInt("READINESS_TIMEOUT_MS", 3000),
  betterAuthSecret: getEnvString("BETTER_AUTH_SECRET"),
  betterAuthUrl: getEnvString("BETTER_AUTH_URL", `http://localhost:${port}`),
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: getEnvString("EMAIL_FROM", "onboarding@resend.dev"),
  sessionExpiresInSeconds: getEnvInt("SESSION_EXPIRES_IN_SECONDS", 604800),
  sessionUpdateAgeSeconds: getEnvInt("SESSION_UPDATE_AGE_SECONDS", 86400),
  jwtExpirationTime: getEnvString("JWT_EXPIRATION_TIME", "15m"),
} as const;

