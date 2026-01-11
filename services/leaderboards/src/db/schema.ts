import { pgTable, uuid, varchar, numeric, integer, timestamp } from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  distance: numeric("distance", { precision: 10, scale: 2 }).notNull(), // in meters
  duration: integer("duration").notNull(), // in seconds
  pace: numeric("pace", { precision: 5, scale: 2 }), // min/km
  avgSpeed: numeric("avg_speed", { precision: 5, scale: 2 }), // km/h
  calories: integer("calories"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
