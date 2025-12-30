import { pgTable, uuid, varchar, decimal, timestamp, integer, text } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  gender: varchar("gender", { length: 50 }), // e.g., 'male', 'female', 'other'
  height: decimal("height", { precision: 5, scale: 2 }), // in cm
  weight: decimal("weight", { precision: 5, scale: 2 }), // in kg
  image: text("image"), // base64 encoded image (max 256x256)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  distance: decimal("distance", { precision: 10, scale: 2 }).notNull(), // in meters
  duration: integer("duration").notNull(), // in seconds
  pace: decimal("pace", { precision: 5, scale: 2 }), // min/km
  calories: integer("calories"), // estimated calories burned
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
