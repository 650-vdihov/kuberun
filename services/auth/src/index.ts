import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import dotenv from "dotenv";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.TRUSTED_ORIGINS?.split(",") || [
      "http://localhost:4000",
    ],
    credentials: true,
  })
);

// Health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", service: "auth" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// Readiness check - verify dependencies are ready
app.get("/ready", async (c) => {
  const checks: { name: string; status: "ok" | "error"; error?: string }[] = [];

  // Check database connectivity with timeout
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database timeout")), 3000)
    );
    const dbPromise = db.execute(sql`SELECT 1`);

    await Promise.race([dbPromise, timeoutPromise]);
    checks.push({ name: "database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "database",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  const allHealthy = checks.every((check) => check.status === "ok");

  return c.json({ ready: allHealthy, checks }, allHealthy ? 200 : 503);
});

// Mount better-auth handler on /api/auth/*
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// JWKS endpoint for microservices to fetch public keys for JWT validation
// Services should cache this and refresh periodically
app.get("/.well-known/jwks.json", async (c) => {
  const response = await auth.handler(
    new Request(new URL("/api/auth/jwks", c.req.url).toString())
  );
  return response;
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 4001;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🚀 Auth service is running on http://localhost:${info.port}`);
  }
);
