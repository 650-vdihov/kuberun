import { pgTable, uuid, varchar, decimal, timestamp, integer, text, real } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
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
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, paused, completed
  distance: decimal("distance", { precision: 10, scale: 2 }), // in meters
  duration: integer("duration"), // in seconds
  pace: decimal("pace", { precision: 5, scale: 2 }), // min/km
  avgSpeed: decimal("avg_speed", { precision: 5, scale: 2 }), // km/h
  calories: integer("calories"), // estimated calories burned
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Weather enrichment fields
  weatherCondition: varchar("weather_condition", { length: 20 }), // sunny, cloudy, rainy, snowy, stormy
  weatherTemp: decimal("weather_temp", { precision: 4, scale: 1 }), // temperature in Celsius
  weatherIcon: varchar("weather_icon", { length: 20 }), // icon category (same as condition)
  weatherDescription: varchar("weather_description", { length: 255 }), // full description from API
});

export const runTrackingPoints = pgTable("run_tracking_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  altitude: real("altitude"), // in meters
  speed: real("speed"), // in m/s
  accuracy: real("accuracy"), // in meters
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunTrackingPoint = typeof runTrackingPoints.$inferSelect;
export type NewRunTrackingPoint = typeof runTrackingPoints.$inferInsert;
