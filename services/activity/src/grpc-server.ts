import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { db } from "./db/index.js";
import { runs, userProfiles } from "./db/schema.js";
import { sql, inArray, and, gte, lte } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, "proto", "activity.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const activityProto = grpc.loadPackageDefinition(packageDefinition).activity as any;

async function getRunStats(call: any, callback: any) {
  try {
    const { user_ids, start_date, end_date } = call.request;

    if (!user_ids || user_ids.length === 0) {
      return callback(null, { stats: [] });
    }

    // Build query conditions
    const conditions = [
      inArray(runs.userId, user_ids),
      sql`${runs.status} = 'completed'`,
    ];

    if (start_date) {
      conditions.push(gte(runs.startTime, new Date(start_date)));
    }

    if (end_date) {
      conditions.push(lte(runs.startTime, new Date(end_date)));
    }

    // Query aggregated stats
    const result = await db
      .select({
        user_id: runs.userId,
        total_distance: sql<number>`COALESCE(SUM(CAST(${runs.distance} AS NUMERIC)), 0)`,
        total_duration: sql<number>`COALESCE(SUM(${runs.duration}), 0)`,
      })
      .from(runs)
      .where(and(...conditions))
      .groupBy(runs.userId);

    const stats = result.map((row) => ({
      user_id: row.user_id,
      total_distance: Number(row.total_distance),
      total_duration: Number(row.total_duration),
    }));

    callback(null, { stats });
  } catch (error) {
    console.error("Error in getRunStats:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: error instanceof Error ? error.message : "Internal error",
    });
  }
}

async function getUserProfiles(call: any, callback: any) {
  try {
    const { user_ids } = call.request;

    if (!user_ids || user_ids.length === 0) {
      return callback(null, { profiles: [] });
    }

    // Query user profiles
    const profiles = await db
      .select({
        user_id: userProfiles.userId,
        name: userProfiles.name,
        email: userProfiles.email,
        image: userProfiles.image,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, user_ids));

    callback(null, { profiles });
  } catch (error) {
    console.error("Error in getUserProfiles:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: error instanceof Error ? error.message : "Internal error",
    });
  }
}

export function startGrpcServer(port: number) {
  const server = new grpc.Server();

  server.addService(activityProto.ActivityService.service, {
    GetRunStats: getRunStats,
    GetUserProfiles: getUserProfiles,
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error("Failed to start gRPC server:", err);
        return;
      }
      console.log(`🔌 gRPC server running on port ${boundPort}`);
    }
  );
}
