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

    // Set up consumer
    setupConsumer();

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

function setupConsumer(): void {
  if (!channel) {
    console.warn("[RabbitMQ] Cannot setup consumer - no channel");
    return;
  }

  console.log(
    `[RabbitMQ] Starting to consume from queue: ${RUN_COMPLETED_QUEUE}`
  );

  channel.consume(
    RUN_COMPLETED_QUEUE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (msg: any) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          const data: RunCompletedMessage = JSON.parse(content);

          console.log("==========================================");
          console.log("[RabbitMQ] Received run.completed event:");
          console.log(`  Run ID:     ${data.runId}`);
          console.log(`  User ID:    ${data.userId}`);
          console.log(
            `  Distance:   ${(parseFloat(data.distance) / 1000).toFixed(2)} km`
          );
          console.log(
            `  Duration:   ${Math.floor(data.duration / 60)}m ${data.duration % 60}s`
          );
          console.log(`  Pace:       ${data.pace} min/km`);
          console.log(`  Avg Speed:  ${data.avgSpeed} km/h`);
          console.log(`  Calories:   ${data.calories}`);
          console.log(`  Start Time: ${data.startTime}`);
          console.log(`  End Time:   ${data.endTime}`);
          console.log(`  Completed:  ${data.completedAt}`);
          console.log("==========================================");

          // Acknowledge the message
          channel?.ack(msg);
        } catch (err) {
          console.error(
            "[RabbitMQ] Error processing message:",
            err instanceof Error ? err.message : err
          );
          // Reject the message and don't requeue
          channel?.nack(msg, false, false);
        }
      }
    },
    { noAck: false }
  );
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
 * Initialize RabbitMQ connection and start consuming in the background.
 * This function returns immediately - connection happens asynchronously.
 * A background loop continuously monitors and reconnects if needed.
 * Use isConnected() to check connection status.
 */
export function startConsuming(): void {
  // Start initial connection attempt
  connect().then(() => {
    // Start the reconnection loop in background
    reconnectLoop();
  });
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
