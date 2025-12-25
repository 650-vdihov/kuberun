import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import dotenv from "dotenv";
import { auth } from "./auth.js";

dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.TRUSTED_ORIGINS?.split(",") || ["http://localhost:3000"],
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

// Mount better-auth handler on /api/auth/*
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3010;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🚀 Auth service is running on http://localhost:${info.port}`);
  }
);
