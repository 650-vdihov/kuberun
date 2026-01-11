import amqp from "amqplib";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { runs } from "./db/schema.js";

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

// In-memory cache for leaderboard invalidation tracking
// Maps clubId to a timestamp when it was last invalidated
const leaderboardInvalidationCache = new Map<string, number>();

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

    // Add connection timeout and heartbeat to detect dead connections
    connection = await amqp.connect(config.rabbitmqUrl, {
      timeout: config.rabbitmqConnectionTimeoutMs,
      heartbeat: config.rabbitmqHeartbeatSeconds,
    });

    channel = await connection.createChannel();

    // Ensure the queue exists
    await channel.assertQueue(config.rabbitmqRunCompletedQueue, { durable: true });

    console.log("[RabbitMQ] Connected successfully");

    // Set up consumer
    await setupConsumer();

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

async function setupConsumer(): Promise<void> {
  if (!channel) {
    return;
  }

  try {
    await channel.consume(
      config.rabbitmqRunCompletedQueue,
      async (msg: any) => {
        if (msg) {
          try {
            const data: RunCompletedMessage = JSON.parse(msg.content.toString());
            console.log(`[RabbitMQ] Received run completed event for run ${data.runId}`);

            // Process the run completion and wait for it to complete
            await processRunCompletion(data);
            
            channel?.ack(msg);
          } catch (error) {
            console.error("[RabbitMQ] Error processing message:", error);
            // Reject and requeue the message
            channel?.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    console.log(`[RabbitMQ] Consumer set up for queue '${config.rabbitmqRunCompletedQueue}'`);
  } catch (error) {
    console.error("[RabbitMQ] Failed to set up consumer:", error);
  }
}

async function processRunCompletion(data: RunCompletedMessage): Promise<void> {
  // Store the run data in the local database for leaderboard calculations
  try {
    await db.insert(runs).values({
      id: data.runId,
      userId: data.userId,
      distance: data.distance,
      duration: data.duration,
      pace: data.pace,
      avgSpeed: data.avgSpeed,
      calories: data.calories,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      completedAt: new Date(data.completedAt),
    });
    
    console.log(`[Leaderboard] Successfully stored run ${data.runId} for user ${data.userId}`);
  } catch (error) {
    console.error(`[Leaderboard] Error storing run ${data.runId}:`, error);
    throw error; // Re-throw to trigger nack
  }
}

/**
 * Get the last invalidation time for a club's leaderboard
 * Can be used to implement cache-control mechanisms
 */
export function getLeaderboardLastInvalidated(clubId: string): number | undefined {
  return leaderboardInvalidationCache.get(clubId);
}

/**
 * Manually invalidate a club's leaderboard cache
 */
export function invalidateLeaderboard(clubId: string): void {
  leaderboardInvalidationCache.set(clubId, Date.now());
  console.log(`[Leaderboard] Invalidated cache for club ${clubId}`);
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
    await new Promise((resolve) => setTimeout(resolve, config.rabbitmqReconnectIntervalMs));
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

export function isConnected(): boolean {
  return channel !== null && connection !== null;
}

export async function closeRabbitMQ(): Promise<void> {
  shouldRun = false;

  if (channel) {
    try {
      await channel.close();
    } catch (err) {
      console.error("[RabbitMQ] Error closing channel:", err);
    }
    channel = null;
  }

  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.error("[RabbitMQ] Error closing connection:", err);
    }
    connection = null;
  }

  console.log("[RabbitMQ] Connection closed");
}
