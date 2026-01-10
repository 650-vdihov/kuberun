import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  image: text("image"), // URL or base64
  preferences: jsonb("preferences").notNull().default({ timezone: "UTC", distanceUnit: "km" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(), // user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clubMembers = pgTable("club_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"), // admin, member
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const clubInvites = pgTable("club_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  invitedUserEmail: varchar("invited_user_email", { length: 255 }).notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(), // user ID
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
export type ClubMember = typeof clubMembers.$inferSelect;
export type NewClubMember = typeof clubMembers.$inferInsert;
export type ClubInvite = typeof clubInvites.$inferSelect;
export type NewClubInvite = typeof clubInvites.$inferInsert;
