import amqp from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://user:password@localhost:5672";
const RUN_COMPLETED_QUEUE = "run.completed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any = null;

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

async function connectWithRetry(maxRetries = 5, delay = 5000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RabbitMQ] Connection attempt ${attempt}/${maxRetries}...`);
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      // Ensure the queue exists
      await channel.assertQueue(RUN_COMPLETED_QUEUE, { durable: true });

      console.log("[RabbitMQ] Connected successfully");

      // Handle connection errors
      connection.on("error", (err: Error) => {
        console.error("[RabbitMQ] Connection error:", err.message);
        connection = null;
        channel = null;
      });

      connection.on("close", () => {
        console.log("[RabbitMQ] Connection closed");
        connection = null;
        channel = null;
      });

      return;
    } catch (err) {
      console.error(
        `[RabbitMQ] Connection attempt ${attempt} failed:`,
        err instanceof Error ? err.message : err
      );
      if (attempt < maxRetries) {
        console.log(`[RabbitMQ] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.error(
    "[RabbitMQ] Failed to connect after all retries. Running without message queue."
  );
}

export async function initRabbitMQ(): Promise<void> {
  await connectWithRetry();
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
    return false;
  }
}

export async function closeRabbitMQ(): Promise<void> {
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
