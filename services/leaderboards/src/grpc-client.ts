import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load activity proto
const ACTIVITY_PROTO_PATH = join(__dirname, "proto", "activity.proto");
const activityPackageDefinition = protoLoader.loadSync(ACTIVITY_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const activityProto = grpc.loadPackageDefinition(activityPackageDefinition)
  .activity as any;

// Load clubs proto
const CLUBS_PROTO_PATH = join(__dirname, "proto", "clubs.proto");
const clubsPackageDefinition = protoLoader.loadSync(CLUBS_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const clubsProto = grpc.loadPackageDefinition(clubsPackageDefinition)
  .clubs as any;

// Create clients
let activityClient: any;
let clubsClient: any;

export function initGrpcClients(activityUrl: string, clubsUrl: string) {
  activityClient = new activityProto.ActivityService(
    activityUrl,
    grpc.credentials.createInsecure()
  );

  clubsClient = new clubsProto.ClubsService(
    clubsUrl,
    grpc.credentials.createInsecure()
  );

  console.log(`🔌 gRPC clients initialized`);
  console.log(`   Activity: ${activityUrl}`);
  console.log(`   Clubs: ${clubsUrl}`);
}

export interface RunStats {
  user_id: string;
  total_distance: number;
  total_duration: number;
}

export function getRunStats(
  user_ids: string[],
  start_date: string,
  end_date?: string
): Promise<RunStats[]> {
  return new Promise((resolve, reject) => {
    activityClient.GetRunStats(
      { user_ids, start_date, end_date },
      (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response.stats || []);
        }
      }
    );
  });
}

export function getClubMembers(club_id: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    clubsClient.GetClubMembers({ club_id }, (error: any, response: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(response.user_ids || []);
      }
    });
  });
}
