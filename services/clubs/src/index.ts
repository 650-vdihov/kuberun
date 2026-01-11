import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { metricsHandler, metricsMiddleware } from "@repo/metrics";
import { config } from "./config.js";
import { authMiddleware, getUser } from "./middleware/auth.js";
import { db } from "./db/index.js";
import { clubs, clubMembers, clubInvites } from "./db/schema.js";
import { eq, and, sql, or, desc, inArray } from "drizzle-orm";
import { startGrpcServer } from "./grpc-server.js";
import { initGrpcClient, getUserProfiles } from "./grpc-client.js";

const app = new Hono();

app.use("*", metricsMiddleware());
app.use("*", logger());
app.use(
  "/*",
  cors({
    origin: config.trustedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (c) => {
  return c.text("Clubs Service");
});

app.get("/metrics", metricsHandler);

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "clubs" }, 200);
});

// Readiness check
app.get("/ready", async (c) => {
  const checks: { name: string; status: "ok" | "error"; error?: string }[] = [];

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database timeout")),
        config.readinessTimeoutMs
      )
    );
    const dbPromise = db.execute(sql`SELECT 1`);

    await Promise.race([dbPromise, timeoutPromise]);
    checks.push({ name: "database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "database",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  const allHealthy = checks.every((check) => check.status === "ok");
  return c.json({ ready: allHealthy, checks }, allHealthy ? 200 : 503);
});

// Get all clubs for the authenticated user
app.get("/clubs", authMiddleware(), async (c) => {
  const user = getUser(c);

  const memberships = await db
    .select({
      club: clubs,
      role: clubMembers.role,
      joinedAt: clubMembers.joinedAt,
    })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(eq(clubMembers.userId, user.sub))
    .orderBy(desc(clubMembers.joinedAt));

  // Get member counts for each club
  const clubIds = memberships.map((m) => m.club.id);
  const memberCounts = clubIds.length > 0
    ? await db
        .select({
          clubId: clubMembers.clubId,
          count: sql<number>`count(*)::int`,
        })
        .from(clubMembers)
        .where(inArray(clubMembers.clubId, clubIds))
        .groupBy(clubMembers.clubId)
    : [];

  const countMap = new Map(memberCounts.map((c) => [c.clubId, c.count]));

  return c.json(
    memberships.map((m) => ({
      club: {
        ...m.club,
        memberCount: countMap.get(m.club.id) || 0,
      },
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  );
});

// Create a new club
app.post("/clubs", authMiddleware(), async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { name, description, image } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return c.json({ message: "Club name is required" }, 400);
  }

  if (name.trim().length > 255) {
    return c.json({ message: "Club name is too long (max 255 characters)" }, 400);
  }

  // Create club
  const [club] = await db
    .insert(clubs)
    .values({
      name: name.trim(),
      description: description || null,
      image: image || null,
      createdBy: user.sub,
    })
    .returning();

  // Add creator as admin
  await db.insert(clubMembers).values({
    clubId: club.id,
    userId: user.sub,
    role: "admin",
  });

  return c.json({ ...club, memberCount: 1 }, 201);
});

// Get club details
app.get("/clubs/:id", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("id");

  // Check if user is a member
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!membership) {
    return c.json({ message: "Club not found or access denied" }, 404);
  }

  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
  });

  if (!club) {
    return c.json({ message: "Club not found" }, 404);
  }

  // Get member count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(eq(clubMembers.clubId, clubId));

  return c.json({ ...club, memberCount: count });
});

// Get club members
app.get("/clubs/:id/members", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("id");

  // Check if user is a member
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!membership) {
    return c.json({ message: "Club not found or access denied" }, 404);
  }

  const members = await db
    .select()
    .from(clubMembers)
    .where(eq(clubMembers.clubId, clubId))
    .orderBy(desc(clubMembers.joinedAt));

  // Fetch user profiles for all members
  const userIds = members.map(m => m.userId);
  console.log(`Fetching profiles for ${userIds.length} members`);
  
  try {
    const profiles = await getUserProfiles(userIds);
    console.log(`Received ${profiles.length} profiles`);
    const profileMap = new Map(profiles.map(p => [p.user_id, p]));

    // Combine member data with profile data
    const membersWithProfiles = members.map(member => {
      const profile = profileMap.get(member.userId);
      return {
        id: member.userId,
        email: profile?.email || 'unknown@example.com',
        name: profile?.name || 'Unknown User',
        image: profile?.image || null,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });

    return c.json(membersWithProfiles);
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    // Return members without profile data as fallback
    return c.json(members.map(member => ({
      id: member.userId,
      email: 'unknown@example.com',
      name: 'Unknown User',
      image: null,
      role: member.role,
      joinedAt: member.joinedAt,
    })));
  }
});

// Invite user to club (admin only)
app.post("/clubs/:id/invite", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("id");
  const { email } = await c.req.json();

  if (!email || !email.trim()) {
    return c.json({ message: "Email is required" }, 400);
  }

  // Check if user is admin
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!membership || membership.role !== "admin") {
    return c.json({ message: "Only admins can invite members" }, 403);
  }

  // Check if invite already exists
  const existingInvite = await db.query.clubInvites.findFirst({
    where: and(
      eq(clubInvites.clubId, clubId),
      eq(clubInvites.invitedUserEmail, email.trim().toLowerCase()),
      eq(clubInvites.status, "pending")
    ),
  });

  if (existingInvite) {
    return c.json({ message: "Invite already sent" }, 400);
  }

  const [invite] = await db
    .insert(clubInvites)
    .values({
      clubId,
      invitedUserEmail: email.trim().toLowerCase(),
      invitedBy: user.sub,
      status: "pending",
    })
    .returning();

  return c.json(invite, 201);
});

// Get user's invites
app.get("/invites", authMiddleware(), async (c) => {
  const user = getUser(c);

  const invites = await db
    .select({
      invite: clubInvites,
      club: clubs,
    })
    .from(clubInvites)
    .innerJoin(clubs, eq(clubs.id, clubInvites.clubId))
    .where(
      and(
        eq(clubInvites.invitedUserEmail, user.email.toLowerCase()),
        eq(clubInvites.status, "pending")
      )
    )
    .orderBy(desc(clubInvites.createdAt));

  return c.json(invites);
});

// Accept invite
app.post("/invites/:id/accept", authMiddleware(), async (c) => {
  const user = getUser(c);
  const inviteId = c.req.param("id");

  const invite = await db.query.clubInvites.findFirst({
    where: and(
      eq(clubInvites.id, inviteId),
      eq(clubInvites.invitedUserEmail, user.email.toLowerCase()),
      eq(clubInvites.status, "pending")
    ),
  });

  if (!invite) {
    return c.json({ message: "Invite not found" }, 404);
  }

  // Check if already a member
  const existingMember = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, invite.clubId), eq(clubMembers.userId, user.sub)),
  });

  if (existingMember) {
    // Update invite status anyway
    await db
      .update(clubInvites)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(clubInvites.id, inviteId));
    return c.json({ message: "Already a member" }, 400);
  }

  // Add user to club
  await db.insert(clubMembers).values({
    clubId: invite.clubId,
    userId: user.sub,
    role: "member",
  });

  // Update invite status
  await db
    .update(clubInvites)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(clubInvites.id, inviteId));

  return c.json({ message: "Invite accepted" });
});

// Decline invite
app.post("/invites/:id/decline", authMiddleware(), async (c) => {
  const user = getUser(c);
  const inviteId = c.req.param("id");

  const invite = await db.query.clubInvites.findFirst({
    where: and(
      eq(clubInvites.id, inviteId),
      eq(clubInvites.invitedUserEmail, user.email.toLowerCase()),
      eq(clubInvites.status, "pending")
    ),
  });

  if (!invite) {
    return c.json({ message: "Invite not found" }, 404);
  }

  await db
    .update(clubInvites)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(clubInvites.id, inviteId));

  return c.json({ message: "Invite declined" });
});

// Leave club
app.delete("/clubs/:id/leave", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("id");

  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!membership) {
    return c.json({ message: "Not a member of this club" }, 404);
  }

  // Check if user is the last admin
  if (membership.role === "admin") {
    const adminCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.role, "admin")));

    if (adminCount[0].count === 1) {
      return c.json({ message: "Cannot leave: you are the last admin" }, 400);
    }
  }

  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)));

  return c.json({ message: "Left club successfully" });
});

// Kick member (admin only)
app.delete("/clubs/:clubId/members/:userId", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");
  const targetUserId = c.req.param("userId");

  // Check if requester is admin
  const requesterMembership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!requesterMembership || requesterMembership.role !== "admin") {
    return c.json({ message: "Only admins can kick members" }, 403);
  }

  // Cannot kick yourself
  if (targetUserId === user.sub) {
    return c.json({ message: "Cannot kick yourself" }, 400);
  }

  // Get target membership
  const targetMembership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)),
  });

  if (!targetMembership) {
    return c.json({ message: "User is not a member" }, 404);
  }

  // Cannot kick another admin
  if (targetMembership.role === "admin") {
    return c.json({ message: "Cannot kick another admin" }, 403);
  }

  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)));

  return c.json({ message: "Member kicked successfully" });
});

// Promote member to admin (admin only)
app.post("/clubs/:clubId/members/:userId/promote", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");
  const targetUserId = c.req.param("userId");

  // Check if requester is admin
  const requesterMembership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!requesterMembership || requesterMembership.role !== "admin") {
    return c.json({ message: "Only admins can promote members" }, 403);
  }

  // Update target user's role
  const updated = await db
    .update(clubMembers)
    .set({ role: "admin" })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)))
    .returning();

  if (updated.length === 0) {
    return c.json({ message: "User is not a member" }, 404);
  }

  return c.json({ message: "Member promoted to admin" });
});

// Demote admin to member (admin only)
app.post("/clubs/:clubId/members/:userId/demote", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");
  const targetUserId = c.req.param("userId");

  // Check if requester is admin
  const requesterMembership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!requesterMembership || requesterMembership.role !== "admin") {
    return c.json({ message: "Only admins can demote members" }, 403);
  }

  // Check if target is admin
  const targetMembership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)),
  });

  if (!targetMembership) {
    return c.json({ message: "User is not a member" }, 404);
  }

  if (targetMembership.role !== "admin") {
    return c.json({ message: "User is not an admin" }, 400);
  }

  // Check if this is the last admin
  const adminCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.role, "admin")));

  if (adminCount[0].count === 1) {
    return c.json({ message: "Cannot demote the last admin" }, 400);
  }

  await db
    .update(clubMembers)
    .set({ role: "member" })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetUserId)));

  return c.json({ message: "Admin demoted to member" });
});

// Update club preferences (admin only)
app.put("/clubs/:id/preferences", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("id");
  const preferences = await c.req.json();

  // Check if user is admin
  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.sub)),
  });

  if (!membership || membership.role !== "admin") {
    return c.json({ message: "Only admins can update preferences" }, 403);
  }

  const [updated] = await db
    .update(clubs)
    .set({ preferences, updatedAt: new Date() })
    .where(eq(clubs.id, clubId))
    .returning();

  return c.json(updated);
});

// Initialize gRPC client
initGrpcClient(config.activityGrpcUrl);

// Start gRPC server
startGrpcServer(config.grpcPort);

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`🚀 Clubs service is running on http://localhost:${info.port}`);
  }
);
