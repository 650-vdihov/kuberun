import { Context, Next, MiddlewareHandler } from "hono";
import client, {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

// Create a dedicated registry for the service
const register = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Concurrent requests gauge
const httpRequestsInProgress = new Gauge({
  name: "http_requests_in_progress",
  help: "Number of HTTP requests currently being processed",
  labelNames: ["method"] as const,
  registers: [register],
});

/**
 * Normalize path to avoid high-cardinality labels
 * Replaces UUIDs and numeric IDs with placeholders
 */
function normalizePath(path: string): string {
  return (
    path
      // Replace UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ":id"
      )
      // Replace numeric IDs in paths
      .replace(/\/\d+(?=\/|$)/g, "/:id")
  );
}

/**
 * Hono middleware for collecting HTTP metrics
 */
export function metricsMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    const path = normalizePath(new URL(c.req.url).pathname);

    // Skip metrics endpoint to avoid recursion
    if (path === "/metrics") {
      return next();
    }

    httpRequestsInProgress.inc({ method });
    const timer = httpRequestDuration.startTimer({ method, path });

    await next();

    const status = c.res.status.toString();
    timer({ status });
    httpRequestsTotal.inc({ method, path, status });
    httpRequestsInProgress.dec({ method });
  };
}

/**
 * Handler for /metrics endpoint
 * Returns Prometheus-formatted metrics
 */
export async function metricsHandler(c: Context) {
  c.header("Content-Type", register.contentType);
  const metrics = await register.metrics();
  return c.text(metrics);
}

/**
 * Get the Prometheus registry for custom metrics
 */
export function getRegistry(): Registry {
  return register;
}

/**
 * Create a custom counter metric
 */
export function createCounter(
  name: string,
  help: string,
  labelNames: string[] = []
): Counter {
  return new Counter({
    name,
    help,
    labelNames,
    registers: [register],
  });
}

/**
 * Create a custom histogram metric
 */
export function createHistogram(
  name: string,
  help: string,
  labelNames: string[] = [],
  buckets?: number[]
): Histogram {
  return new Histogram({
    name,
    help,
    labelNames,
    buckets: buckets || [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [register],
  });
}

/**
 * Create a custom gauge metric
 */
export function createGauge(
  name: string,
  help: string,
  labelNames: string[] = []
): Gauge {
  return new Gauge({
    name,
    help,
    labelNames,
    registers: [register],
  });
}

// Re-export prom-client types for convenience
export { Counter, Histogram, Gauge, Registry };
export { client as promClient };
