import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { db } from "./db/index.js";
import { runs } from "./db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, "proto", "leaderboards.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const leaderboardsProto = grpc.loadPackageDefinition(packageDefinition)
  .leaderboards as any;

async function recordRun(call: any, callback: any) {
  try {
    const {
      run_id,
      user_id,
      distance,
      duration,
      pace,
      avg_speed,
      calories,
      start_time,
      end_time,
      completed_at,
    } = call.request;

    console.log(`[gRPC] Recording run ${run_id} for user ${user_id}`);

    // Insert run data into local database
    await db.insert(runs).values({
      id: run_id,
      userId: user_id,
      distance: distance.toString(),
      duration,
      pace: pace.toString(),
      avgSpeed: avg_speed.toString(),
      calories,
      startTime: new Date(start_time),
      endTime: new Date(end_time),
      completedAt: new Date(completed_at),
    });

    console.log(`[gRPC] Successfully recorded run ${run_id}`);

    callback(null, {
      success: true,
      message: "Run recorded successfully",
    });
  } catch (error) {
    console.error("[gRPC] Error recording run:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: error instanceof Error ? error.message : "Internal error",
    });
  }
}

export function startGrpcServer(port: number) {
  const server = new grpc.Server();

  server.addService(leaderboardsProto.LeaderboardsService.service, {
    RecordRun: recordRun,
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error("[gRPC] Failed to start server:", err);
        return;
      }
      console.log(`[gRPC] Leaderboards server listening on port ${boundPort}`);
    }
  );

  return server;
}
