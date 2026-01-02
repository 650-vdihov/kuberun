import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://user:password@localhost:5672";
const RUN_COMPLETED_QUEUE = "run.completed";
const RECONNECT_INTERVAL = 10000; // 10 seconds between reconnection attempts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any = null;
let isConnecting = false;
let reconnectLoopRunning = false;
let shouldRun = true;

export interface RunCompletedMessage {
  runId: string;
  userId: string;
  distance: string;
  duration: number;
  pace: string;
  avgSpeed: string;
  calories: number;
  startTime: Date;
  endTime: Date;
  completedAt: Date;
}

async function connect(): Promise<boolean> {
  if (isConnecting) {
    return false;
  }

  // If already connected, verify the connection is still alive
  if (connection && channel) {
    return true;
  }

  isConnecting = true;

  try {
    console.log("[RabbitMQ] Attempting to connect...");

    // Add connection timeout (5 seconds) and heartbeat to detect dead connections
    connection = await amqp.connect(RABBITMQ_URL, {
      timeout: 5000,
      heartbeat: 30, // Send heartbeat every 30 seconds to detect dead connections
    });

    channel = await connection.createChannel();

    // Ensure the queue exists
    await channel.assertQueue(RUN_COMPLETED_QUEUE, { durable: true });

    console.log("[RabbitMQ] Connected successfully");

    // Handle connection errors - clear references so reconnect loop picks it up
    connection.on("error", (err: Error) => {
      console.error("[RabbitMQ] Connection error:", err.message);
      cleanupConnection();
    });

    connection.on("close", () => {
      console.log("[RabbitMQ] Connection closed");
      cleanupConnection();
    });

    isConnecting = false;
    return true;
  } catch (err) {
    console.error(
      "[RabbitMQ] Connection failed:",
      err instanceof Error ? err.message : err
    );
    cleanupConnection();
    isConnecting = false;
    return false;
  }
}

function cleanupConnection(): void {
  connection = null;
  channel = null;
}

/**
 * Continuous reconnection loop that runs in the background.
 * Checks connection status periodically and reconnects if needed.
 */
async function reconnectLoop(): Promise<void> {
  if (reconnectLoopRunning) {
    return;
  }

  reconnectLoopRunning = true;

  while (shouldRun) {
    // If not connected, try to connect
    if (!connection || !channel) {
      await connect();
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
  }

  reconnectLoopRunning = false;
}

/**
 * Initialize RabbitMQ connection in the background.
 * This function returns immediately - connection happens asynchronously.
 * A background loop continuously monitors and reconnects if needed.
 * Use isConnected() to check connection status.
 */
export function initRabbitMQ(): void {
  // Start initial connection attempt
  connect().then(() => {
    // Start the reconnection loop in background
    reconnectLoop();
  });
}

export async function publishRunCompleted(
  data: RunCompletedMessage
): Promise<boolean> {
  if (!channel) {
    console.warn("[RabbitMQ] Not connected, cannot publish message");
    return false;
  }

  try {
    const message = JSON.stringify(data);
    channel.sendToQueue(RUN_COMPLETED_QUEUE, Buffer.from(message), {
      persistent: true,
      contentType: "application/json",
    });
    console.log(`[RabbitMQ] Published run.completed for run ${data.runId}`);
    return true;
  } catch (err) {
    console.error(
      "[RabbitMQ] Failed to publish message:",
      err instanceof Error ? err.message : err
    );
    // Connection might be dead, cleanup so reconnect loop picks it up
    cleanupConnection();
    return false;
  }
}

export function isConnected(): boolean {
  return channel !== null && connection !== null;
}

export async function closeRabbitMQ(): Promise<void> {
  shouldRun = false; // Stop reconnection loop

  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log("[RabbitMQ] Connection closed gracefully");
  } catch (err) {
    console.error(
      "[RabbitMQ] Error closing connection:",
      err instanceof Error ? err.message : err
    );
  } finally {
    cleanupConnection();
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await closeRabbitMQ();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeRabbitMQ();
  process.exit(0);
});
