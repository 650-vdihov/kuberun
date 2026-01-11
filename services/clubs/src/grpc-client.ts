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

// Create client
let activityClient: any;

export function initGrpcClient(activityUrl: string) {
  activityClient = new activityProto.ActivityService(
    activityUrl,
    grpc.credentials.createInsecure()
  );

  console.log(`🔌 gRPC client initialized: Activity: ${activityUrl}`);
}

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  image: string | null;
}

export async function getUserProfiles(userIds: string[]): Promise<UserProfile[]> {
  return new Promise((resolve, reject) => {
    if (!activityClient) {
      return reject(new Error("Activity gRPC client not initialized"));
    }

    activityClient.GetUserProfiles(
      { user_ids: userIds },
      (error: any, response: any) => {
        if (error) {
          console.error("Error calling GetUserProfiles:", error);
          return reject(error);
        }
        resolve(response.profiles || []);
      }
    );
  });
}
