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

export async function startConsuming(): Promise<void> {
  await connectWithRetry();

  if (!channel) {
    console.warn("[RabbitMQ] Not connected, cannot start consuming");
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
