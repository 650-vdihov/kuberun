import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { db } from "./db/index.js";
import { clubMembers } from "./db/schema.js";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, "proto", "clubs.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const clubsProto = grpc.loadPackageDefinition(packageDefinition).clubs as any;

async function getClubMembers(call: any, callback: any) {
  try {
    const { club_id } = call.request;

    if (!club_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        details: "club_id is required",
      });
    }

    const members = await db
      .select({ userId: clubMembers.userId })
      .from(clubMembers)
      .where(eq(clubMembers.clubId, club_id));

    const user_ids = members.map((m) => m.userId);

    callback(null, { user_ids });
  } catch (error) {
    console.error("Error in getClubMembers:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: error instanceof Error ? error.message : "Internal error",
    });
  }
}

export function startGrpcServer(port: number) {
  const server = new grpc.Server();

  server.addService(clubsProto.ClubsService.service, {
    GetClubMembers: getClubMembers,
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
