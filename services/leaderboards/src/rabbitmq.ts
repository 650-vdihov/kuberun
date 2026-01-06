import amqp from "amqplib";
import { config } from "./config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any = null;
let isConnecting = false;
let reconnectTimeout: NodeJS.Timeout | null = null;

interface RunCompletedMessage {
  runId: string;
  userId: string;
  distance: number;
  duration: number;
  completedAt: string;
}

export async function connectRabbitMQ(): Promise<void> {
  if (isConnecting || connection) {
    return;
  }

  isConnecting = true;

  try {
    console.log("Connecting to RabbitMQ...");
    
    connection = await amqp.connect(config.rabbitmqUrl, {
      heartbeat: config.rabbitmqHeartbeatSeconds,
      timeout: config.rabbitmqConnectionTimeoutMs,
    });

    console.log("✓ Connected to RabbitMQ");

    // Handle connection errors
    connection.on("error", (err: any) => {
      console.error("RabbitMQ connection error:", err.message);
      scheduleReconnect();
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed");
      connection = null;
      channel = null;
      scheduleReconnect();
    });

    // Create channel
    channel = await connection.createChannel();
    console.log("✓ RabbitMQ channel created");

    // Declare queue
    await channel.assertQueue(config.rabbitmqRunCompletedQueue, { durable: true });
    console.log(`✓ Queue '${config.rabbitmqRunCompletedQueue}' asserted`);

    isConnecting = false;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error);
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimeout) {
    return;
  }

  console.log(`Scheduling RabbitMQ reconnect in ${config.rabbitmqReconnectIntervalMs}ms...`);
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectRabbitMQ();
  }, config.rabbitmqReconnectIntervalMs);
}

export async function startConsuming(): Promise<void> {
  // Start connection in background
  connectRabbitMQ();

  // Wait a bit for connection to establish
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (!channel) {
    console.log("Channel not ready yet, will retry later");
    return;
  }

  try {
    await channel.consume(
      config.rabbitmqRunCompletedQueue,
      async (msg: any) => {
        if (msg) {
          try {
            const data: RunCompletedMessage = JSON.parse(msg.content.toString());
            console.log("Received run completed event:", data);

            // Here you would update leaderboard caches/aggregations
            // For now, just acknowledge the message
            
            channel?.ack(msg);
          } catch (error) {
            console.error("Error processing message:", error);
            // Reject and requeue the message
            channel?.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    console.log(`✓ Consuming messages from '${config.rabbitmqRunCompletedQueue}'`);
  } catch (error) {
    console.error("Failed to start consuming:", error);
  }
}

export function isConnected(): boolean {
  return connection !== null && channel !== null;
}

export async function closeRabbitMQ(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (channel) {
    await channel.close();
    channel = null;
  }

  if (connection) {
    await connection.close();
    connection = null;
  }

  console.log("RabbitMQ connection closed");
}
