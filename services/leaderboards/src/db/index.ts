import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";

// Activity database connection
const activityClient = postgres(config.activityDbUrl);
export const activityDb = drizzle(activityClient);

// Clubs database connection
const clubsClient = postgres(config.clubsDbUrl);
export const clubsDb = drizzle(clubsClient);

// Schemas - import from other services' schemas
// We'll define minimal type interfaces for what we need

export interface Run {
  id: string;
  userId: string;
  status: string;
  distance: string | null;
  duration: number | null;
  pace: string | null;
  avgSpeed: string | null;
  calories: number | null;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
}

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}
